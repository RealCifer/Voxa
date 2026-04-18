"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { loadVoxaConfig } from "@/lib/config";
import { getGroqApiKey } from "@/lib/groqClient";
import { useAppStore } from "@/lib/store/app-store";

const AUTO_REFRESH_MS = 30_000;

export function SuggestionsPanel() {
  const batches = useAppStore((s) => s.suggestionBatches);
  const transcript = useAppStore((s) => s.transcript);
  const prependBatch = useAppStore((s) => s.prependSuggestionBatch);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastHashRef = useRef<string>("");

  const config = useMemo(() => loadVoxaConfig(), []);

  const recentTranscript = useMemo(() => {
    const n = Math.max(1, config.suggestionContextWindow);
    const slice = transcript.slice(-n).map((s) => s.text.trim()).filter(Boolean);
    const joined = slice.join("\n");
    return joined.length > 2000 ? joined.slice(-2000) : joined;
  }, [config.suggestionContextWindow, transcript]);

  async function refreshOnce() {
    if (!recentTranscript) return;
    const hash = `${transcript.length}:${recentTranscript.slice(-160)}`;
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    setIsRefreshing(true);
    try {
      const apiKey = getGroqApiKey();
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-groq-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          transcript: recentTranscript,
          prompt: config.suggestionPrompt,
        }),
      });

      const json = (await res.json()) as {
        suggestions?: Array<{ kind?: string; preview?: string }>;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error ?? "Suggestion request failed");

      const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
      if (suggestions.length !== 3) throw new Error("Suggestions must be exactly 3");

      const items = suggestions.map((s) => ({
        id: crypto.randomUUID(),
        kind: (s.kind ?? "clarification") as "question" | "answer" | "clarification" | "fact-check",
        preview: (s.preview ?? "").trim(),
        source: "llm" as const,
      }));

      prependBatch(items as never);
    } catch (e) {
      console.error("[suggestions error]", e);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!recentTranscript) return;
    const id = globalThis.setInterval(() => {
      void refreshOnce();
    }, AUTO_REFRESH_MS);
    return () => globalThis.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentTranscript]);

  return (
    <Panel
      title="Suggestions"
      aside={
        <button
          type="button"
          onClick={() => void refreshOnce()}
          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
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
                      {s.preview}
                    </p>
                    <span className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      {s.kind}
                    </span>
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
