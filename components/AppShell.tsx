"use client";

import { AppHeader } from "@/components/AppHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";

export function AppShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <AppHeader />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-neutral-200 md:grid-cols-3 dark:bg-neutral-800">
        <TranscriptPanel />
        <SuggestionsPanel />
        <ChatPanel />
      </div>
    </div>
  );
}
