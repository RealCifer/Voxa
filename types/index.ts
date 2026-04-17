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
