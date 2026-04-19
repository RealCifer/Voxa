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

function badgeClass(kind: Suggestion["kind"]): string {
  if (kind === "question") {
    return "border-blue-500/40 bg-blue-950/50 text-blue-200";
  }
  if (kind === "insight") {
    return "border-violet-500/40 bg-violet-950/50 text-violet-200";
  }
  return "border-amber-500/40 bg-amber-950/50 text-amber-200";
}

function formatBatchTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function SuggestionSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/45 p-4 shadow-md shadow-black/20 backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className="mb-3 h-5 w-20 rounded-lg bg-zinc-800/90" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded-lg bg-zinc-800/70" />
        <div className="h-4 max-w-[88%] rounded-lg bg-zinc-800/55" />
      </div>
    </div>
  );
}

export function SuggestionsPanel() {
  const batches = useAppStore((s) => s.suggestionBatches);
  const transcript = useAppStore((s) => s.transcript);
  const prependBatch = useAppStore((s) => s.prependSuggestionBatch);
  const pushChat = useAppStore((s) => s.pushChat);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [suggestionChatError, setSuggestionChatError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [fadeInBatchIds, setFadeInBatchIds] = useState<string[]>([]);
  const seenBatchIdsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    const fresh = batches.filter((b) => !seenBatchIdsRef.current.has(b.id));
    if (fresh.length === 0) return;
    fresh.forEach((b) => seenBatchIdsRef.current.add(b.id));
    setFadeInBatchIds(fresh.map((b) => b.id));
    const t = globalThis.setTimeout(() => setFadeInBatchIds([]), 220);
    return () => globalThis.clearTimeout(t);
  }, [batches]);

  return (
    <Panel
      title="Suggestions"
      aside={
        <button
          type="button"
          onClick={() => void refreshOnce()}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/45 px-3 py-2 text-xs font-semibold text-zinc-100 shadow-sm backdrop-blur-sm transition duration-200 hover:border-zinc-700 hover:bg-zinc-900/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <div className="space-y-5">
        {refreshError ? (
          <div
            className="flex items-start justify-between gap-2 rounded-2xl border border-red-900/50 bg-red-950/35 px-3 py-2.5 shadow-sm backdrop-blur-sm"
            role="alert"
          >
            <p className="min-w-0 flex-1 text-xs text-red-100">{refreshError}</p>
            <button
              type="button"
              onClick={() => setRefreshError(null)}
              className="shrink-0 rounded-xl px-2 py-0.5 text-[11px] font-medium text-red-200 transition-opacity duration-150 hover:bg-red-900/40"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {suggestionChatError ? (
          <div
            className="flex items-start justify-between gap-2 rounded-2xl border border-red-900/50 bg-red-950/35 px-3 py-2.5 shadow-sm backdrop-blur-sm"
            role="alert"
          >
            <p className="min-w-0 flex-1 text-xs text-red-100">{suggestionChatError}</p>
            <button
              type="button"
              onClick={() => setSuggestionChatError(null)}
              className="shrink-0 rounded-xl px-2 py-0.5 text-[11px] font-medium text-red-200 transition-opacity duration-150 hover:bg-red-900/40"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {isRefreshing ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading suggestions">
            <p className="text-xs font-semibold text-zinc-400">Updating suggestions…</p>
            <SuggestionSkeleton />
            <SuggestionSkeleton />
            <SuggestionSkeleton />
          </div>
        ) : null}

        {batches.map((b) => (
          <section
            key={b.id}
            className={`space-y-3 ${fadeInBatchIds.includes(b.id) ? "voxa-fade-in" : ""}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/90 pb-2">
              <span className="text-xs font-semibold text-zinc-300">Batch</span>
              <time className="text-[11px] tabular-nums text-zinc-400" dateTime={b.createdAt}>
                {formatBatchTime(b.createdAt)}
              </time>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {b.items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title="Open in chat with transcript context"
                  disabled={expandingId !== null}
                  onClick={() => void onSuggestionActivate(s)}
                  className="group w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/45 p-4 text-left shadow-md shadow-black/15 backdrop-blur-sm transition duration-200 ease-out hover:scale-105 hover:border-zinc-600 hover:shadow-[0_0_28px_-6px_rgba(59,130,246,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-md"
                >
                  <div className="flex flex-col gap-3">
                    <span
                      className={`w-fit rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(s.kind)}`}
                    >
                      {s.kind}
                    </span>
                    <p className="min-w-0 text-sm font-semibold leading-relaxed text-zinc-100">
                      {expandingId === s.id ? "Opening in chat…" : s.preview}
                    </p>
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
