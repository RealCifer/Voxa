import { NextResponse } from "next/server";

import { defaultVoxaConfig } from "@/lib/config";
import { CHAT_TRANSCRIPT_MAX_CHARS } from "@/lib/transcriptFormat";

export const runtime = "nodejs";
const CHAT_MESSAGE_MAX = 80;
const MAX_OUTPUT_TOKENS = 4096;

type Turn = { role: "user" | "assistant"; content: string };

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
    out.push({ role: m.role, content: text.slice(0, 24_000) });
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  const apiKey =
    process.env.GROQ_API_KEY?.trim() ||
    req.headers.get("x-groq-api-key")?.trim() ||
    null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Groq API key (set GROQ_API_KEY or send x-groq-api-key)" },
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
  };

  if (typeof b.transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const transcript = b.transcript.trim().slice(-CHAT_TRANSCRIPT_MAX_CHARS);
  const transcriptBlock = transcript || "(No transcript captured yet.)";

  const messages = coerceMessages(b.messages);
  if (!messages) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const chatPrompt =
    typeof b.chatPrompt === "string" && b.chatPrompt.trim()
      ? b.chatPrompt.trim()
      : defaultVoxaConfig.chatPrompt;

  const detailPrompt =
    typeof b.detailPrompt === "string" && b.detailPrompt.trim()
      ? b.detailPrompt.trim()
      : defaultVoxaConfig.detailPrompt;

  const suggestionRaw = b.suggestion as { kind?: unknown; preview?: unknown } | undefined;
  const suggestion =
    suggestionRaw &&
    typeof suggestionRaw.kind === "string" &&
    typeof suggestionRaw.preview === "string" &&
    suggestionRaw.preview.trim()
      ? {
          kind: suggestionRaw.kind.trim().slice(0, 64),
          preview: suggestionRaw.preview.trim().slice(0, 2000),
        }
      : undefined;

  const systemParts = [
    "You are a conversational assistant for a live, voice-transcribed workspace.",
    "Respond in clear Markdown-friendly prose (not JSON). Ground your answer in the TRANSCRIPT when it is relevant.",
    "Do not repeat the entire transcript back unless the user explicitly asks.",
    "",
    "User-configured assistant instructions:",
    chatPrompt,
    "",
    "--- BEGIN TRANSCRIPT ---",
    transcriptBlock,
    "--- END TRANSCRIPT ---",
  ];

  if (suggestion) {
    systemParts.push(
      "",
      "The user activated a suggestion card from the suggestions panel:",
      `Kind: ${suggestion.kind}`,
      `Suggestion text: ${suggestion.preview}`,
      "",
      "For this turn, expand on that suggestion with a substantive, detailed answer.",
      detailPrompt,
      "Use clear structure (short sections, bullets where helpful). Reference specific transcript lines or themes when useful. Close with concrete next steps or focused follow-up questions when appropriate.",
    );
  }

  const system = systemParts.join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      temperature: suggestion ? 0.35 : 0.45,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: "Groq chat failed", status: res.status, details: raw },
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
