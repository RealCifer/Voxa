import type { TranscriptSegment } from "@/types";

export const LLM_TRANSCRIPT_HARD_CAP = 32_000;

function normalizeLine(s: string): string {
  return s.trim().replaceAll(/\s+/g, " ");
}

/** Collapses consecutive duplicate lines (normalized whitespace) to save LLM tokens. */
export function dedupeConsecutiveLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let prevNorm = "";
  for (const line of lines) {
    const n = normalizeLine(line);
    if (n.length === 0) {
      if (out.length === 0 || out.at(-1) !== "") out.push("");
      prevNorm = "";
      continue;
    }
    if (n === prevNorm) continue;
    out.push(n);
    prevNorm = n;
  }
  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out.join("\n");
}

function joinSegmentTexts(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function formatTranscriptTail(
  segments: TranscriptSegment[],
  lastNSegments: number,
  maxChars = LLM_TRANSCRIPT_HARD_CAP,
): string {
  const n = Math.max(1, lastNSegments);
  let t = joinSegmentTexts(segments.slice(-n));
  if (t.length > maxChars) t = t.slice(-maxChars);
  return t;
}

/** Tail segments → text → dedupe → char cap (for /api/chat and /api/suggest inputs). */
export function formatTranscriptForLlm(
  segments: TranscriptSegment[],
  lastNSegments: number,
  maxChars: number,
): string {
  let t = formatTranscriptTail(segments, lastNSegments, LLM_TRANSCRIPT_HARD_CAP);
  t = dedupeConsecutiveLines(t);
  const cap = Math.min(Math.max(256, maxChars), LLM_TRANSCRIPT_HARD_CAP);
  if (t.length > cap) t = t.slice(-cap);
  return t;
}
