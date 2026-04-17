"use client";

import { useRealtimeSession } from "@/hooks/useRealtimeSession";
import { useAppStore } from "@/lib/store/app-store";

const sessionBadge: Record<string, string> = {
  idle: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  connecting: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  reconnecting: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  error: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
};

export function AppHeader() {
  const sessionLabel = useAppStore((s) => s.sessionLabel);
  const { state } = useRealtimeSession();

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Voxa
        </h1>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-500">{sessionLabel}</p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-xs capitalize ${sessionBadge[state] ?? sessionBadge.idle}`}
      >
        {state}
      </span>
    </header>
  );
}
