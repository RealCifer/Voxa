import { NextResponse } from "next/server";

import { GroqFetchError, groqFetch } from "@/lib/groqClient";
import { GROQ_CHAT_COMPLETIONS_MODEL, groqApiKeyFromRequest } from "@/lib/groqServer";
import { dedupeConsecutiveLines } from "@/lib/transcriptFormat";

export const runtime = "nodejs";

const TRANSCRIPT_SNIPPET_MAX_CHARS = 6000;
const MAX_TOKENS = 400;
const TEMPERATURE = 0.35;

function snippetFromTranscript(raw: string): string {
  const deduped = dedupeConsecutiveLines(raw.trim());
  if (!deduped) return "";
  return deduped.length > TRANSCRIPT_SNIPPET_MAX_CHARS
    ? deduped.slice(-TRANSCRIPT_SNIPPET_MAX_CHARS)
    : deduped;
}

function suggestionFromObject(o: Record<string, unknown>): string | null {
  let text = "";
  if (typeof o.text === "string") text = o.text;
  else if (typeof o.preview === "string") text = o.preview;

  let label = "";
  if (typeof o.kind === "string") label = o.kind;
  else if (typeof o.type === "string") label = o.type;

  const t = text.trim().slice(0, 3000);
  if (!t) return null;
  const lab = label.trim().slice(0, 64);
  return lab ? `[${lab}] ${t}` : t;
}

/** Plain string or { text | preview, kind? | type? }. */
function resolveSelectedSuggestion(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().slice(0, 3000);
  }
  if (raw && typeof raw === "object") {
    return suggestionFromObject(raw as Record<string, unknown>);
  }
  return null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    transcript?: unknown;
    selectedSuggestion?: unknown;
    suggestion?: unknown;
    apiKey?: unknown;
  };

  if (typeof b.transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const selectedRaw = b.selectedSuggestion ?? b.suggestion;
  const selectedLine = resolveSelectedSuggestion(selectedRaw);
  if (!selectedLine) {
    return NextResponse.json(
      { error: "Missing selectedSuggestion (string or object with text/preview)." },
      { status: 400 },
    );
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
    return NextResponse.json({
      answer:
        "There is no transcript text to work from yet. Start recording or paste context, then try again.",
    });
  }

  const system = [
    "You expand a single suggestion in a live meeting context.",
    "TRANSCRIPT (truncated tail, deduplicated lines):",
    snippet,
    "",
    "SELECTED SUGGESTION:",
    selectedLine,
    "",
    "Rules:",
    "- Reply in clear Markdown (short headings or bullets are fine).",
    "- Be concise but informative; respect the low output token budget.",
    "- Ground claims only in the transcript; do not invent facts, names, numbers, or commitments.",
    "- If the transcript is insufficient, say what is missing and ask one focused follow-up question.",
  ].join("\n");

  const userMsg =
    "Write the structured answer now. Do not repeat the full transcript; refer to it only as needed.";

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
        messages: [
          { role: "system", content: system.slice(0, 24_000) },
          { role: "user", content: userMsg },
        ],
      },
    });

    const answer = (raw.choices?.[0]?.message?.content ?? "").trim();
    if (!answer) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof GroqFetchError) {
      return NextResponse.json(
        {
          error: `Detail request failed: ${e.message}`,
          status: e.status,
          details: e.rawBody,
        },
        { status: 502 },
      );
    }
    throw e;
  }
}
