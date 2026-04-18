import type { TranscriptSegment } from "@/types";

/** Hard upper bound for transcript text sent to any LLM route (tail slice). */
export const LLM_TRANSCRIPT_HARD_CAP = 32_000;

/** @deprecated Use `LLM_TRANSCRIPT_HARD_CAP` */
export const CHAT_TRANSCRIPT_MAX_CHARS = LLM_TRANSCRIPT_HARD_CAP;

function normalizeLine(s: string): string {
  return s.trim().replaceAll(/\s+/g, " ");
}

/**
 * Collapses consecutive duplicate lines (after whitespace normalization).
 * Cuts token waste from stuttering / repeated ASR lines.
 */
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

/** Full transcript text in segment order (for export and non-LLM use). */
export function formatFullTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");
}

/** Last N segments joined, optionally trimmed by max chars from the end. */
export function formatTranscriptTail(
  segments: TranscriptSegment[],
  lastNSegments: number,
  maxChars = LLM_TRANSCRIPT_HARD_CAP,
): string {
  const n = Math.max(1, lastNSegments);
  const slice = segments.slice(-n);
  let t = slice
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");
  if (t.length > maxChars) t = t.slice(-maxChars);
  return t;
}

/**
 * Last N transcript segments → newline text → dedupe repeated lines → char budget (tail).
 * Use for all LLM transcript context.
 */
export function formatTranscriptForLlm(
  segments: TranscriptSegment[],
  lastNSegments: number,
  maxChars: number,
): string {
  const n = Math.max(1, lastNSegments);
  const slice = segments.slice(-n);
  let t = slice
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");
  t = dedupeConsecutiveLines(t);
  const cap = Math.min(Math.max(256, maxChars), LLM_TRANSCRIPT_HARD_CAP);
  if (t.length > cap) t = t.slice(-cap);
  return t;
}
