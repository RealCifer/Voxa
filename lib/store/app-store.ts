import { create } from "zustand";
import type { ChatMessage, Suggestion, TranscriptSegment } from "@/types";

type AppStore = {
  transcript: TranscriptSegment[];
  suggestions: Suggestion[];
  chat: ChatMessage[];
  sessionLabel: string;
  setSessionLabel: (label: string) => void;
  appendTranscript: (segment: TranscriptSegment) => void;
  setSuggestions: (items: Suggestion[]) => void;
  pushChat: (message: ChatMessage) => void;
  resetWorkspace: () => void;
};

const seedSuggestions: Suggestion[] = [
  { id: "s1", text: "Summarize the last minute", source: "llm" },
  { id: "s2", text: "Draft a follow-up question", source: "llm" },
];

export const useAppStore = create<AppStore>((set) => ({
  transcript: [],
  suggestions: seedSuggestions,
  chat: [],
  sessionLabel: "Session",
  setSessionLabel: (label) => set({ sessionLabel: label }),
  appendTranscript: (segment) =>
    set((s) => ({ transcript: [...s.transcript, segment] })),
  setSuggestions: (items) => set({ suggestions: items }),
  pushChat: (message) => set((s) => ({ chat: [...s.chat, message] })),
  resetWorkspace: () =>
    set({ transcript: [], suggestions: seedSuggestions, chat: [] }),
}));
