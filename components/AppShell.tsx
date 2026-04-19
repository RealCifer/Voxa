"use client";

import { AppHeader } from "@/components/AppHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";

export function AppShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-h-0">
          <TranscriptPanel />
          <SuggestionsPanel />
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
