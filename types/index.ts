export type TranscriptSegment = {
  id: string;
  text: string;
  startMs: number;
  endMs?: number;
  isFinal?: boolean;
};

export type Suggestion = {
  id: string;
  kind: "question" | "insight" | "clarification";
  preview: string;
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
  /** System instructions when a suggestion card is opened; supports {{recent_transcript}} and {{suggestion}}. */
  detailPrompt: string;
  suggestionContextWindow: number;
  chatContextWindow: number;
  /** Max characters of transcript (after dedupe) sent with chat / suggestion-detail requests. */
  chatTranscriptMaxChars: number;
  /** Max characters of transcript sent when refreshing suggestions. */
  suggestionTranscriptMaxChars: number;
  /** Max user+assistant messages included in a chat completion request. */
  chatMaxMessages: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};
