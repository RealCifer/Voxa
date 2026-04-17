"use client";

import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

export function TranscriptPanel() {
  const transcript = useAppStore((s) => s.transcript);

  return (
    <Panel title="Transcript">
      {transcript.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-500">
          Live segments will appear here when audio is connected.
        </p>
      ) : (
        <ul className="space-y-2">
          {transcript.map((seg) => (
            <li key={seg.id} className="rounded border border-neutral-100 p-2 dark:border-neutral-800">
              <span className="text-xs text-neutral-400">
                {seg.startMs}ms
                {seg.isFinal ? " · final" : ""}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{seg.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
