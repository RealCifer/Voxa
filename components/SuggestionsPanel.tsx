"use client";

import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

export function SuggestionsPanel() {
  const batches = useAppStore((s) => s.suggestionBatches);
  const refresh = useAppStore((s) => s.refreshSuggestions);

  return (
    <Panel
      title="Suggestions"
      aside={
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
        >
          Refresh
        </button>
      }
    >
      <div className="space-y-4">
        {batches.map((b) => (
          <section key={b.id} className="space-y-2">
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Batch · {b.createdAt.slice(11, 19)}Z
            </div>
            <div className="grid grid-cols-1 gap-2">
              {b.items.map((s) => (
                <article
                  key={s.id}
                  className="rounded border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm text-neutral-800 dark:text-neutral-200">
                      {s.text}
                    </p>
                    {s.source ? (
                      <span className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                        {s.source}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
