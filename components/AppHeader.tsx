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
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Voxa
        </h1>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-500">{sessionLabel}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExportSession}
          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
        >
          Export session
        </button>
        <Link
          href="/settings"
          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
        >
          Settings
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            isMicActive
              ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          }`}
          title={isMicActive ? "Microphone is on" : "Microphone is off"}
        >
          {isMicActive ? "Recording" : "Mic idle"}
        </span>
      </div>
    </header>
  );
}
