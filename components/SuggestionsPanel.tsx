"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { loadVoxaConfig } from "@/lib/config";
import { requestDetail } from "@/lib/detailClient";
import { getGroqApiKey } from "@/lib/groqClient";
import { requestSuggestions } from "@/lib/suggestionsClient";
import { useAppStore } from "@/lib/store/app-store";
import { formatTranscriptForLlm } from "@/lib/transcriptFormat";
import type { Suggestion } from "@/types";

const AUTO_REFRESH_MS = 30_000;

export function SuggestionsPanel() {
  const batches = useAppStore((s) => s.suggestionBatches);
  const transcript = useAppStore((s) => s.transcript);
  const prependBatch = useAppStore((s) => s.prependSuggestionBatch);
  const pushChat = useAppStore((s) => s.pushChat);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [suggestionChatError, setSuggestionChatError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const lastHashRef = useRef<string>("");
  const inFlightRefreshRef = useRef(false);

  const config = useMemo(() => loadVoxaConfig(), []);

  const lastSeg = transcript.length > 0 ? transcript.at(-1) : null;

  /** Timed tail for suggestion smart window (`getSmartContext`); keeps payload bounded. */
  const segmentsForSuggest = useMemo(() => {
    const n = Math.min(
      transcript.length,
      Math.max(config.suggestionContextWindow, 150),
    );
    return transcript.slice(-n).map((s) => {
      const seg: { id: string; text: string; startMs: number; endMs?: number } = {
        id: s.id,
        text: s.text,
        startMs: s.startMs,
      };
      if (typeof s.endMs === "number") seg.endMs = s.endMs;
      return seg;
    });
  }, [config.suggestionContextWindow, transcript]);

  async function refreshOnce() {
    if (inFlightRefreshRef.current) return;
    if (transcript.length === 0) return;

    const tailHint = (lastSeg?.text ?? "").slice(-96);
    const hash = `${transcript.length}:${lastSeg?.id ?? ""}:${tailHint}`;
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    inFlightRefreshRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const apiKey = getGroqApiKey();
      const result = await requestSuggestions({
        apiKey,
        segments: segmentsForSuggest,
        lineLimit: Math.min(80, Math.max(24, config.suggestionContextWindow * 2)),
        smartSeconds: config.suggestionSmartSeconds,
        maxTranscriptChars: config.suggestionTranscriptMaxChars,
      });
      if ("error" in result) {
        setRefreshError(result.error);
        return;
      }

      prependBatch(result.suggestions);
    } catch (e) {
      console.error("[suggestions error]", e);
      setRefreshError(
        e instanceof Error ? e.message : "Could not refresh suggestions. Check your connection.",
      );
    } finally {
      setIsRefreshing(false);
      inFlightRefreshRef.current = false;
    }
  }

  async function onSuggestionActivate(s: Suggestion) {
    if (expandingId) return;

    const apiKey = getGroqApiKey()?.trim() ?? "";
    if (!apiKey) {
      setSuggestionChatError("Add your Groq API key in Settings to use chat from suggestions.");
      return;
    }

    const transcriptForDetail = formatTranscriptForLlm(
      transcript,
      config.chatContextWindow,
      Math.min(4096, config.chatTranscriptMaxChars),
    );
    if (!transcriptForDetail.trim()) {
      setSuggestionChatError("Transcript is empty. Start recording so there is context to use.");
      return;
    }

    setSuggestionChatError(null);
    setExpandingId(s.id);

    const userLine = `Selected suggestion (${s.kind}): ${s.preview}`;
    pushChat({
      id: crypto.randomUUID(),
      role: "user",
      content: userLine,
      createdAt: new Date().toISOString(),
    });

    try {
      const result = await requestDetail({
        apiKey,
        transcript: transcriptForDetail,
        selectedSuggestion: { kind: s.kind, preview: s.preview },
      });

      if ("error" in result) {
        setSuggestionChatError(result.error);
        pushChat({
          id: crypto.randomUUID(),
          role: "system",
          content: `Couldn’t expand that suggestion. ${result.error}`,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      pushChat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setExpandingId(null);
    }
  }

  useEffect(() => {
    if (transcript.length === 0) return;
    const id = globalThis.setInterval(() => {
      void refreshOnce();
    }, AUTO_REFRESH_MS);
    return () => globalThis.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript.length, lastSeg?.id]);

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
        {refreshError ? (
          <div
            className="flex items-start justify-between gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-900/50 dark:bg-red-950/40"
            role="alert"
          >
            <p className="min-w-0 flex-1 text-xs text-red-800 dark:text-red-200">{refreshError}</p>
            <button
              type="button"
              onClick={() => setRefreshError(null)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-red-800 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {suggestionChatError ? (
          <div
            className="flex items-start justify-between gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-900/50 dark:bg-red-950/40"
            role="alert"
          >
            <p className="min-w-0 flex-1 text-xs text-red-800 dark:text-red-200">
              {suggestionChatError}
            </p>
            <button
              type="button"
              onClick={() => setSuggestionChatError(null)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-red-800 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {batches.map((b) => (
          <section key={b.id} className="space-y-2">
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Batch · {b.createdAt.slice(11, 19)}Z
            </div>
            <div className="grid grid-cols-1 gap-2">
              {b.items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title="Send to chat with transcript context (last N segments)"
                  disabled={expandingId !== null}
                  onClick={() => void onSuggestionActivate(s)}
                  className="w-full rounded border border-neutral-200 bg-white p-2.5 text-left transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm text-neutral-800 dark:text-neutral-200">
                      {expandingId === s.id ? "Opening in chat…" : s.preview}
                    </p>
                    <span className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      {s.kind}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
