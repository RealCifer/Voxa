import { NextResponse } from "next/server";

import { defaultVoxaConfig } from "@/lib/config";
import { GroqFetchError, groqFetch } from "@/lib/groqClient";
import { GROQ_CHAT_COMPLETIONS_MODEL, groqApiKeyFromRequest } from "@/lib/groqServer";
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
const PLACEHOLDER_CHAT_HISTORY = "{{chat_history}}";
const PLACEHOLDER_USER_INPUT = "{{user_input}}";

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

function usesChatPlaceholders(template: string): boolean {
  return (
    template.includes(PLACEHOLDER_TRANSCRIPT) ||
    template.includes(PLACEHOLDER_CHAT_HISTORY) ||
    template.includes(PLACEHOLDER_USER_INPUT)
  );
}

function formatChatHistoryLines(priorTurns: Turn[]): string {
  if (priorTurns.length === 0) return "(No prior messages.)";
  return priorTurns
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n\n");
}

/**
 * Packs transcript, prior turns, and latest user text into the system message; one short user turn for the API.
 */
function buildTemplatedNormalChat(
  template: string,
  transcriptBlock: string,
  trimmedMessages: Turn[],
): { system: string; completionMessages: Turn[] } {
  const last = trimmedMessages.at(-1);
  let userInput = "";
  let prior = trimmedMessages;

  if (last?.role === "user") {
    userInput = last.content;
    prior = trimmedMessages.slice(0, -1);
  }

  const chatHistory = formatChatHistoryLines(prior);
  const system = template
    .replaceAll(PLACEHOLDER_TRANSCRIPT, transcriptBlock)
    .replaceAll(PLACEHOLDER_CHAT_HISTORY, chatHistory)
    .replaceAll(PLACEHOLDER_USER_INPUT, userInput || "(None)")
    .slice(0, 24_000);

  return {
    system,
    completionMessages: [{ role: "user", content: "Respond following the system instructions." }],
  };
}

function buildNormalSystem(chatPrompt: string, transcriptBlock: string): string {
  const head =
    "Transcript assistant. Markdown prose. Use TRANSCRIPT when relevant; do not paste it wholesale.";
  return [head, `Rules: ${chatPrompt}`, `TRANSCRIPT:\n${transcriptBlock}`].join("\n\n");
}

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
      ? b.chatPrompt.trim().slice(0, 12_000)
      : defaultVoxaConfig.chatPrompt;

  const detailPrompt =
    typeof b.detailPrompt === "string" && b.detailPrompt.trim()
      ? b.detailPrompt.trim().slice(0, 12_000)
      : defaultVoxaConfig.detailPrompt;

  const suggestion = coerceSuggestion(b.suggestion);

  let system: string;
  let completionMessages: Turn[] = trimmedMessages;

  if (suggestion) {
    system = buildSuggestionSystem(detailPrompt, chatPrompt, transcriptBlock, suggestion);
  } else if (usesChatPlaceholders(chatPrompt)) {
    const built = buildTemplatedNormalChat(chatPrompt, transcriptBlock, trimmedMessages);
    system = built.system;
    completionMessages = built.completionMessages;
  } else {
    system = buildNormalSystem(chatPrompt, transcriptBlock);
  }

  try {
    const json = await groqFetch<{
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      endpoint: "/chat/completions",
      apiKey,
      body: {
        model: GROQ_CHAT_COMPLETIONS_MODEL,
        temperature: 0.35,
        max_tokens: suggestion ? MAX_OUTPUT_TOKENS_DETAIL : MAX_OUTPUT_TOKENS_CHAT,
        messages: [{ role: "system", content: system }, ...completionMessages],
      },
    });
    const content = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch (e) {
    if (e instanceof GroqFetchError) {
      return NextResponse.json(
        {
          error: `Groq chat failed: ${e.message}`,
          status: e.status,
          details: e.rawBody,
        },
        { status: 502 },
      );
    }
    throw e;
  }
}
