import { NextResponse } from "next/server";

import { GroqFetchError, groqFetch } from "@/lib/groqClient";
import { GROQ_CHAT_COMPLETIONS_MODEL, groqApiKeyFromRequest } from "@/lib/groqServer";
import { dedupeConsecutiveLines } from "@/lib/transcriptFormat";

export const runtime = "nodejs";

/** Tail cap so we never ship an unbounded transcript to the model. */
const TRANSCRIPT_SNIPPET_MAX_CHARS = 2200;

const MAX_WORDS = 20;
const MAX_TOKENS = 150;
const TEMPERATURE = 0.6;

type SuggestionType = "question" | "insight" | "clarification";

function maxWords(text: string, limit: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return w.slice(0, limit).join(" ");
}

function coerceType(raw: unknown): SuggestionType {
  const t = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (t === "question") return "question";
  if (t === "insight" || t === "idea" || t === "answer") return "insight";
  if (t === "clarification" || t === "fact-check" || t === "fact_check") return "clarification";
  return "clarification";
}

function snippetFromTranscript(raw: string): string {
  const deduped = dedupeConsecutiveLines(raw.trim());
  if (!deduped) return "";
  return deduped.length > TRANSCRIPT_SNIPPET_MAX_CHARS
    ? deduped.slice(-TRANSCRIPT_SNIPPET_MAX_CHARS)
    : deduped;
}

function extractList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "suggestions" in parsed) {
    const s = (parsed as { suggestions: unknown }).suggestions;
    return Array.isArray(s) ? s : [];
  }
  return [];
}

type LiveSuggestionItem = {
  type: SuggestionType;
  text: string;
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as { transcript?: unknown; apiKey?: unknown };

  if (typeof b.transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const fromBody = typeof b.apiKey === "string" ? b.apiKey.trim() : "";
  const apiKey = fromBody || groqApiKeyFromRequest(req, null);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing apiKey in JSON body or server/API headers (x-api-key)." },
      { status: 401 },
    );
  }

  const snippet = snippetFromTranscript(b.transcript);
  if (!snippet) {
    return NextResponse.json({ suggestions: [] as LiveSuggestionItem[] });
  }

  const system = [
    "Return ONLY JSON: an object with key suggestions (array of length 3).",
    'Each item: {"type":"question"|"insight"|"clarification","text":"..."}.',
    "Exactly one question, one insight, one clarification. Each text ≤20 words. No other keys.",
  ].join(" ");

  const user = `Recent conversation (truncated tail, deduped lines):\n${snippet}`;

  try {
    const raw = await groqFetch<{
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      endpoint: "/chat/completions",
      apiKey,
      body: {
        model: GROQ_CHAT_COMPLETIONS_MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    });

    const content = raw.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as unknown;
    const arr = extractList(parsed);

    const suggestions: LiveSuggestionItem[] = arr
      .slice(0, 3)
      .map((row) => {
        const item = row as { type?: unknown; text?: unknown; preview?: unknown };
        let textRaw = "";
        if (typeof item.text === "string") textRaw = item.text;
        else if (typeof item.preview === "string") textRaw = item.preview;
        return {
          type: coerceType(item.type),
          text: maxWords(textRaw, MAX_WORDS),
        };
      })
      .filter((s) => s.text.length > 0);

    if (suggestions.length === 3) {
      return NextResponse.json({ suggestions });
    }
  } catch (e) {
    if (e instanceof GroqFetchError) {
      return NextResponse.json(
        {
          error: `Suggestions failed: ${e.message}`,
          status: e.status,
          details: e.rawBody,
        },
        { status: 502 },
      );
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 502 });
    }
    throw e;
  }

  return NextResponse.json({
    suggestions: [
      { type: "question" as const, text: "What is the single outcome we need before this call ends?" },
      { type: "insight" as const, text: "The group keeps circling scope—naming one MVP would unblock decisions." },
      { type: "clarification" as const, text: "When they said “soon,” did they mean this week or this quarter?" },
    ],
  });
}
