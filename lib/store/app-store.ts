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
  prependSuggestionBatch: (items: [Suggestion, Suggestion, Suggestion]) => void;
  pushChat: (message: ChatMessage) => void;
  resetWorkspace: () => void;
};

const seedSuggestionBatches: SuggestionBatch[] = [
  {
    id: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "seed-s1",
        kind: "question",
        preview: "What’s the main goal for the next 30 minutes of this session?",
        source: "llm",
      },
      {
        id: "seed-s2",
        kind: "insight",
        preview: "Splitting the work into two milestones would reduce risk on the unknown piece.",
        source: "llm",
      },
      {
        id: "seed-s3",
        kind: "clarification",
        preview: "When you said “done,” did you mean shipped to users or code-complete?",
        source: "llm",
      },
    ],
  },
];

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
  prependSuggestionBatch: (items) =>
    set((s) => ({
      suggestionBatches: [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          items,
        },
        ...s.suggestionBatches,
      ],
    })),
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
