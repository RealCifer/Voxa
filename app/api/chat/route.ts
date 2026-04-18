import { NextResponse } from "next/server";

import { defaultVoxaConfig } from "@/lib/config";
import {
  GROQ_CHAT_COMPLETIONS_MODEL,
  groqApiKeyFromRequest,
  groqUpstreamErrorSummary,
} from "@/lib/groqServer";
import { dedupeConsecutiveLines, LLM_TRANSCRIPT_HARD_CAP } from "@/lib/transcriptFormat";

export const runtime = "nodejs";

const CHAT_MESSAGE_MAX = 80;
const CHAT_MESSAGE_CONTENT_MAX = 12_000;
const MAX_OUTPUT_TOKENS_CHAT = 1536;
const MAX_OUTPUT_TOKENS_DETAIL = 3072;
const DEFAULT_HISTORY_LIMIT = defaultVoxaConfig.chatMaxMessages;
const DEFAULT_TRANSCRIPT_CAP = defaultVoxaConfig.chatTranscriptMaxChars;

const PLACEHOLDER_TRANSCRIPT = "{{recent_transcript}}";
const PLACEHOLDER_SUGGESTION = "{{suggestion}}";

type Turn = { role: "user" | "assistant"; content: string };

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function coerceMessages(raw: unknown): Turn[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Turn[] = [];
  for (const item of raw) {
    if (out.length >= CHAT_MESSAGE_MAX) break;
    const m = item as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content !== "string") continue;
    const text = m.content.trim();
    if (!text) continue;
    out.push({ role: m.role, content: text.slice(0, CHAT_MESSAGE_CONTENT_MAX) });
  }
  return out.length ? out : null;
}

type SuggestionPayload = { kind: string; preview: string };

function coerceSuggestion(raw: unknown): SuggestionPayload | undefined {
  const s = raw as { kind?: unknown; preview?: unknown } | undefined;
  if (
    s &&
    typeof s.kind === "string" &&
    typeof s.preview === "string" &&
    s.preview.trim()
  ) {
    return { kind: s.kind.trim().slice(0, 64), preview: s.preview.trim().slice(0, 2000) };
  }
  return undefined;
}

function buildNormalSystem(chatPrompt: string, transcriptBlock: string): string {
  const head =
    "Transcript assistant. Markdown prose. Use TRANSCRIPT when relevant; do not paste it wholesale.";
  return [head, `Rules: ${chatPrompt}`, `TRANSCRIPT:\n${transcriptBlock}`].join("\n\n");
}

/** Filled template (placeholders) or legacy stacked instructions if the prompt has no placeholders. */
function buildSuggestionSystem(
  detailPrompt: string,
  chatPrompt: string,
  transcriptBlock: string,
  suggestion: SuggestionPayload,
): string {
  const suggestionLine = `[${suggestion.kind}] ${suggestion.preview}`;
  const tpl = detailPrompt.trim();
  if (tpl.includes(PLACEHOLDER_TRANSCRIPT) || tpl.includes(PLACEHOLDER_SUGGESTION)) {
    return tpl
      .replaceAll(PLACEHOLDER_TRANSCRIPT, transcriptBlock)
      .replaceAll(PLACEHOLDER_SUGGESTION, suggestionLine)
      .slice(0, 24_000);
  }
  const head =
    "Transcript assistant. Markdown prose. Use TRANSCRIPT when relevant; do not paste it wholesale.";
  return [
    head,
    `Rules: ${chatPrompt}`,
    `TRANSCRIPT:\n${transcriptBlock}`,
    `User chose suggestion [${suggestion.kind}]: ${suggestion.preview}`,
    `Expand: ${tpl}`,
  ].join("\n\n");
}

export async function POST(req: Request) {
  const apiKey = groqApiKeyFromRequest(req);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing Groq API key (set GROQ_API_KEY or AI_API_KEY, or add your key in Settings)",
      },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    transcript?: unknown;
    messages?: unknown;
    chatPrompt?: unknown;
    detailPrompt?: unknown;
    suggestion?: unknown;
    chatHistoryLimit?: unknown;
    transcriptMaxChars?: unknown;
  };

  if (typeof b.transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const transcriptCap = clampInt(
    b.transcriptMaxChars,
    512,
    LLM_TRANSCRIPT_HARD_CAP,
    DEFAULT_TRANSCRIPT_CAP,
  );
  let transcript = dedupeConsecutiveLines(b.transcript.trim());
  transcript = transcript.length > transcriptCap ? transcript.slice(-transcriptCap) : transcript;
  const transcriptBlock = transcript || "(No transcript captured yet.)";

  const messages = coerceMessages(b.messages);
  if (!messages) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const historyLimit = clampInt(b.chatHistoryLimit, 2, 80, DEFAULT_HISTORY_LIMIT);
  const trimmedMessages =
    messages.length > historyLimit ? messages.slice(-historyLimit) : messages;

  const chatPrompt =
    typeof b.chatPrompt === "string" && b.chatPrompt.trim()
      ? b.chatPrompt.trim().slice(0, 4000)
      : defaultVoxaConfig.chatPrompt;

  const detailPrompt =
    typeof b.detailPrompt === "string" && b.detailPrompt.trim()
      ? b.detailPrompt.trim().slice(0, 12_000)
      : defaultVoxaConfig.detailPrompt;

  const suggestion = coerceSuggestion(b.suggestion);
  const system = suggestion
    ? buildSuggestionSystem(detailPrompt, chatPrompt, transcriptBlock, suggestion)
    : buildNormalSystem(chatPrompt, transcriptBlock);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_CHAT_COMPLETIONS_MODEL,
      temperature: 0.35,
      max_tokens: suggestion ? MAX_OUTPUT_TOKENS_DETAIL : MAX_OUTPUT_TOKENS_CHAT,
      messages: [{ role: "system", content: system }, ...trimmedMessages],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    const summary = groqUpstreamErrorSummary(res.status, raw);
    return NextResponse.json(
      {
        error: `Groq chat failed: ${summary}`,
        status: res.status,
        details: raw,
      },
      { status: 502 },
    );
  }

  try {
    const json = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: "Invalid upstream JSON", details: raw },
      { status: 502 },
    );
  }
}
