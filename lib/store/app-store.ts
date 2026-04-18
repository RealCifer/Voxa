import { create } from "zustand";
import type { AudioChunk, ChatMessage, Suggestion, SuggestionBatch, TranscriptSegment } from "@/types";

type AppStore = {
  transcript: TranscriptSegment[];
  suggestionBatches: SuggestionBatch[];
  audioChunks: AudioChunk[];
  chat: ChatMessage[];
  sessionLabel: string;
  isMicActive: boolean;
  setSessionLabel: (label: string) => void;
  setMicActive: (active: boolean) => void;
  appendTranscript: (segment: TranscriptSegment) => void;
  pushAudioChunk: (chunk: AudioChunk) => void;
  clearAudioChunks: () => void;
  refreshSuggestions: () => void;
  pushChat: (message: ChatMessage) => void;
  resetWorkspace: () => void;
};

const suggestionPool: Omit<Suggestion, "id">[] = [
  { text: "Summarize the last minute", source: "llm" },
  { text: "Draft a follow-up question", source: "llm" },
  { text: "List action items", source: "llm" },
  { text: "Turn this into an email", source: "llm" },
  { text: "Clarify the main decision", source: "rule" },
  { text: "Ask: what’s the deadline?", source: "rule" },
  { text: "Propose next steps", source: "llm" },
  { text: "Identify open questions", source: "llm" },
  { text: "Create a checklist", source: "llm" },
];

const seedSuggestionBatches: SuggestionBatch[] = [
  {
    id: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [
      { id: "seed-s1", text: "Summarize the last minute", source: "llm" },
      { id: "seed-s2", text: "List action items", source: "llm" },
      { id: "seed-s3", text: "Identify open questions", source: "llm" },
    ],
  },
];

function pick3Suggestions(): [Suggestion, Suggestion, Suggestion] {
  const used = new Set<number>();
  const items: Suggestion[] = [];
  while (items.length < 3) {
    const idx = Math.floor(Math.random() * suggestionPool.length);
    if (used.has(idx)) continue;
    used.add(idx);
    items.push({
      id: crypto.randomUUID(),
      ...suggestionPool[idx],
    });
  }
  return items as [Suggestion, Suggestion, Suggestion];
}

function makeBatch(): SuggestionBatch {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    items: pick3Suggestions(),
  };
}

export const useAppStore = create<AppStore>((set) => ({
  transcript: [],
  suggestionBatches: seedSuggestionBatches,
  audioChunks: [],
  chat: [],
  sessionLabel: "Session",
  isMicActive: false,
  setSessionLabel: (label) => set({ sessionLabel: label }),
  setMicActive: (active) => set({ isMicActive: active }),
  appendTranscript: (segment) =>
    set((s) => ({ transcript: [...s.transcript, segment] })),
  pushAudioChunk: (chunk) => set((s) => ({ audioChunks: [...s.audioChunks, chunk] })),
  clearAudioChunks: () => set({ audioChunks: [] }),
  refreshSuggestions: () => set((s) => ({ suggestionBatches: [makeBatch(), ...s.suggestionBatches] })),
  pushChat: (message) => set((s) => ({ chat: [...s.chat, message] })),
  resetWorkspace: () =>
    set({
      transcript: [],
      suggestionBatches: seedSuggestionBatches,
      audioChunks: [],
      chat: [],
      isMicActive: false,
    }),
}));
