import type { Suggestion, TranscriptSegment } from "@/types";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isKind(x: unknown): x is Suggestion["kind"] {
  return x === "question" || x === "insight" || x === "clarification";
}

function normalizeSuggestionRow(s: {
  type?: unknown;
  kind?: unknown;
  text?: unknown;
  preview?: unknown;
}): { kind: Suggestion["kind"]; preview: string } | null {
  let kind: Suggestion["kind"] = "clarification";
  if (isKind(s.kind)) kind = s.kind;
  else if (isKind(s.type)) kind = s.type;

  let preview = "";
  if (typeof s.preview === "string") preview = s.preview.trim();
  else if (typeof s.text === "string") preview = s.text.trim();

  if (!preview) return null;
  return { kind, preview };
}

export async function requestSuggestions(args: {
  apiKey: string | null;
  segments: Array<Pick<TranscriptSegment, "id" | "text" | "startMs" | "endMs">>;
  lineLimit?: number;
  smartSeconds?: number;
  maxTranscriptChars?: number;
}): Promise<{ suggestions: [Suggestion, Suggestion, Suggestion] } | { error: string }> {
  const res = await fetchWithTimeout("/api/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(args.apiKey ? { "x-groq-api-key": args.apiKey } : {}),
    },
    body: JSON.stringify({
      segments: args.segments,
      lineLimit: args.lineLimit,
      smartSeconds: args.smartSeconds,
      maxTranscriptChars: args.maxTranscriptChars,
    }),
    timeoutMs: 20_000,
  });

  const raw = await res.text();
  const json = parseJsonObject(raw);
  const errMsg = typeof json.error === "string" ? json.error : null;

  if (!res.ok) {
    let fallback = `Suggestions failed (${res.status}). Try again.`;
    if (res.status === 401) fallback = "Not authorized. Check your API key in Settings or server env.";
    if (res.status === 400) fallback = "Invalid suggestions request.";
    return { error: errMsg ?? fallback };
  }
  if (errMsg) return { error: errMsg };

  const list = Array.isArray(json.suggestions) ? json.suggestions : [];
  const normalized = list
    .slice(0, 3)
    .map((s) => normalizeSuggestionRow(s as { type?: unknown; kind?: unknown; text?: unknown; preview?: unknown }))
    .filter((s): s is { kind: Suggestion["kind"]; preview: string } => Boolean(s))
    .slice(0, 3)
    .map((s) => ({
      id: crypto.randomUUID(),
      kind: s.kind,
      preview: s.preview,
      source: "llm" as const,
    }));

  if (normalized.length !== 3) return { error: "Suggestions response was invalid. Try Refresh again." };
  return { suggestions: normalized as [Suggestion, Suggestion, Suggestion] };
}

