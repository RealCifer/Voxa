import type { ChatMessage, SuggestionBatch, TranscriptSegment } from "@/types";

export const SESSION_EXPORT_SCHEMA_VERSION = 1 as const;

export type SessionExportTranscriptSegment = TranscriptSegment & {
  startOffsetLabel: string;
  endOffsetLabel?: string;
};

export type SessionExportSuggestionItem = {
  position: 1 | 2 | 3;
  id: string;
  kind: string;
  preview: string;
  source?: string;
};

export type SessionExportSuggestionBatch = {
  batchIndex: number;
  id: string;
  createdAt: string;
  items: SessionExportSuggestionItem[];
};

export type SessionExportChatMessage = Pick<ChatMessage, "id" | "role" | "content" | "createdAt">;

export type VoxaSessionExport = {
  schemaVersion: typeof SESSION_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  sessionLabel: string;
  transcript: SessionExportTranscriptSegment[];
  suggestionBatches: SessionExportSuggestionBatch[];
  chat: SessionExportChatMessage[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export function formatSessionOffsetMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00.000";
  const totalMs = Math.floor(ms);
  const frac = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}.${pad3(frac)}`;
  }
  return `${m}:${pad2(s)}.${pad3(frac)}`;
}

function mapTranscript(segments: TranscriptSegment[]): SessionExportTranscriptSegment[] {
  return segments.map((seg) => {
    const end =
      seg.endMs === undefined ? {} : { endOffsetLabel: formatSessionOffsetMs(seg.endMs) };
    return {
      ...seg,
      startOffsetLabel: formatSessionOffsetMs(seg.startMs),
      ...end,
    };
  });
}

function mapSuggestionBatches(batches: SuggestionBatch[]): SessionExportSuggestionBatch[] {
  return batches.map((batch, batchIndex) => ({
    batchIndex: batchIndex + 1,
    id: batch.id,
    createdAt: batch.createdAt,
    items: batch.items.map((item, i) => ({
      position: (i + 1) as 1 | 2 | 3,
      id: item.id,
      kind: item.kind,
      preview: item.preview,
      ...(item.source ? { source: item.source } : {}),
    })),
  }));
}

function mapChat(messages: ChatMessage[]): SessionExportChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

export function buildSessionExport(args: {
  sessionLabel: string;
  transcript: TranscriptSegment[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
  exportedAt?: string;
}): VoxaSessionExport {
  return {
    schemaVersion: SESSION_EXPORT_SCHEMA_VERSION,
    exportedAt: args.exportedAt ?? new Date().toISOString(),
    sessionLabel: args.sessionLabel,
    transcript: mapTranscript(args.transcript),
    suggestionBatches: mapSuggestionBatches(args.suggestionBatches),
    chat: mapChat(args.chat),
  };
}

function sanitizeFilenamePart(label: string): string {
  const t = label.trim().replaceAll(/[^\w-]+/g, "-").replaceAll(/-+/g, "-");
  const s = t.replaceAll(/^-+|-+$/g, "");
  return s.slice(0, 64) || "session";
}

export function defaultSessionExportFilename(sessionLabel: string, exportedAt: string): string {
  const day = exportedAt.slice(0, 10);
  const time = exportedAt.slice(11, 19).replaceAll(":", "");
  return `voxa-session-${sanitizeFilenamePart(sessionLabel)}-${day}T${time}Z.json`;
}

export function downloadSessionJson(exportPayload: VoxaSessionExport): void {
  const json = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultSessionExportFilename(exportPayload.sessionLabel, exportPayload.exportedAt);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
