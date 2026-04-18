export type TranscriptSegment = {
  id: string;
  text: string;
  startMs: number;
  endMs?: number;
  isFinal?: boolean;
};

export type Suggestion = {
  id: string;
  text: string;
  source?: "llm" | "rule" | "user";
};

export type SuggestionBatch = {
  id: string;
  createdAt: string;
  items: [Suggestion, Suggestion, Suggestion];
};

export type AudioChunk = {
  id: string;
  createdAt: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
};

export type VoxaConfig = {
  suggestionPrompt: string;
  chatPrompt: string;
  detailPrompt: string;
  suggestionContextWindow: number;
  chatContextWindow: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type RealtimeSessionState =
  | "idle"
  | "connecting"
  | "active"
  | "reconnecting"
  | "error";
