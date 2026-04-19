"use client";

import Link from "next/link";
import { buildSessionExport, downloadSessionJson } from "@/lib/sessionExport";
import { useAppStore } from "@/lib/store/app-store";

export function AppHeader() {
  const sessionLabel = useAppStore((s) => s.sessionLabel);
  const isMicActive = useAppStore((s) => s.isMicActive);

  function onExportSession() {
    const { transcript, suggestionBatches, chat, sessionLabel: label } = useAppStore.getState();
    downloadSessionJson(
      buildSessionExport({
        sessionLabel: label,
        transcript,
        suggestionBatches,
        chat,
      }),
    );
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-slate-950/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Voxa
        </h1>
        <p className="truncate text-xs text-zinc-400">{sessionLabel}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExportSession}
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-sm hover:bg-zinc-900/60"
        >
          Export session
        </button>
        <Link
          href="/settings"
          className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-sm hover:bg-zinc-900/60"
        >
          Settings
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            isMicActive
              ? "border border-red-900/60 bg-red-950/40 text-red-100"
              : "border border-zinc-700 bg-zinc-900/40 text-zinc-300"
          }`}
          title={isMicActive ? "Microphone is on" : "Microphone is off"}
        >
          {isMicActive ? "Recording" : "Mic idle"}
        </span>
      </div>
    </header>
  );
}
