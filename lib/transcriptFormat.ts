import type { TranscriptSegment } from "@/types";

/** Align with `/api/chat` transcript cap (tail). */
export const CHAT_TRANSCRIPT_MAX_CHARS = 32_000;

/** Full transcript text in segment order (for suggestion follow-ups). */
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
  maxChars = CHAT_TRANSCRIPT_MAX_CHARS,
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
