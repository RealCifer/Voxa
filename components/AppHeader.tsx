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

  const btn =
    "rounded-2xl border border-zinc-800 bg-zinc-900/45 px-3 py-2 text-xs font-semibold text-zinc-100 shadow-sm backdrop-blur-sm transition duration-200 hover:border-zinc-700 hover:bg-zinc-900/70 active:scale-[0.98]";

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800/90 bg-zinc-900/35 px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-xl md:px-6">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Voxa</h1>
        <p className="truncate text-xs text-zinc-400">{sessionLabel}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onExportSession} className={btn}>
          Export session
        </button>
        <Link href="/settings" className={btn}>
          Settings
        </Link>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity duration-200 ${
            isMicActive
              ? "border-red-800/60 bg-red-950/45 text-red-100"
              : "border-zinc-800 bg-zinc-900/45 text-zinc-300"
          }`}
          title={isMicActive ? "Microphone is on" : "Microphone is off"}
        >
          {isMicActive ? "Recording" : "Mic idle"}
        </span>
      </div>
    </header>
  );
}
