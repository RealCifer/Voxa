import type { TranscriptSegment } from "@/types";
import { dedupeConsecutiveLines } from "@/lib/transcriptFormat";

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

/** Optional `segments` from JSON for timed smart window. */
export function parseSuggestionSegments(raw: unknown): TranscriptSegment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TranscriptSegment[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    const sm = typeof o.startMs === "number" ? o.startMs : Number(o.startMs);
    if (!text.trim() || !Number.isFinite(sm)) continue;
    let endMs: number | undefined;
    if (typeof o.endMs === "number" && Number.isFinite(o.endMs)) endMs = o.endMs;
    else if (o.endMs !== undefined) {
      const n = Number(o.endMs);
      if (Number.isFinite(n)) endMs = n;
    }
    out.push({
      id: typeof o.id === "string" ? o.id : "",
      text,
      startMs: sm,
      endMs,
      isFinal: true,
    });
  }
  return out.length > 0 ? out : undefined;
}

export type OptimizeSuggestionContextOpts = {
  charCap: number;
  lineLimit?: number;
  smartSeconds?: number;
};

/**
 * Builds a compact transcript for suggestion models: smart time window when `segments` exist,
 * else recent deduped lines from `transcript`; then compression + tail char cap (never full blind send).
 */
export function optimizeTranscriptForSuggestions(
  transcript: string | undefined,
  segments: TranscriptSegment[] | undefined,
  opts: OptimizeSuggestionContextOpts,
): string {
  const charCap = Math.max(256, Math.floor(opts.charCap));
  const lineLimit = opts.lineLimit ?? 24;
  const smartSeconds = opts.smartSeconds ?? 90;

  let core: string;
  if (segments && segments.length > 0) {
    core = dedupeConsecutiveLines(getSmartContext(segments, smartSeconds));
  } else {
    const source = typeof transcript === "string" ? transcript : "";
    const deduped = dedupeConsecutiveLines(source.trim());
    const lines = deduped
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    core = getRecentTranscript(lines, lineLimit);
  }

  const compressed = compressTranscript(core);
  return compressed.length > charCap ? compressed.slice(-charCap) : compressed;
}
