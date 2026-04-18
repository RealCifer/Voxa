import type { TranscriptSegment } from "@/types";

const FILLER_RE = /\b(um|uh|okay|yeah|like)\b/gi;

/** Last `limit` non-empty lines, joined with newlines. */
export function getRecentTranscript(transcript: string[], limit = 20): string {
  const n = Math.max(0, Math.floor(limit));
  if (n === 0) return "";
  const lines = transcript.map((s) => s.trim()).filter((s) => s.length > 0);
  if (lines.length === 0) return "";
  return lines.slice(-n).join("\n");
}

/**
 * Lines whose time range overlaps the last `seconds` of the timeline (by max end/start in `transcript`).
 */
export function getSmartContext(transcript: TranscriptSegment[], seconds = 90): string {
  if (transcript.length === 0) return "";

  const windowMs = Math.max(0, seconds) * 1000;
  let tMax = 0;
  for (const seg of transcript) {
    const end = seg.endMs ?? seg.startMs;
    tMax = Math.max(tMax, end, seg.startMs);
  }
  const cutoff = tMax - windowMs;

  const lines: string[] = [];
  for (const seg of transcript) {
    const start = seg.startMs;
    const end = seg.endMs ?? seg.startMs;
    if (end < cutoff || start > tMax) continue;
    const t = seg.text.trim();
    if (t) lines.push(t);
  }
  return lines.join("\n");
}

/** Drops common filler tokens and collapses whitespace. */
export function compressTranscript(text: string): string {
  return text.replaceAll(FILLER_RE, " ").replaceAll(/\s+/g, " ").trim();
}
