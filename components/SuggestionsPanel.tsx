"use client";

import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

export function SuggestionsPanel() {
  const suggestions = useAppStore((s) => s.suggestions);

  return (
    <Panel title="Suggestions">
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="rounded border border-dashed border-neutral-200 px-2 py-1.5 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            {s.text}
            {s.source ? (
              <span className="ml-2 text-xs text-neutral-400">({s.source})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
