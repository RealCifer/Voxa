"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { requestChatCompletion } from "@/lib/chatClient";
import { loadVoxaConfig } from "@/lib/config";
import { getGroqApiKey } from "@/lib/groqClient";
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

  const config = useMemo(() => loadVoxaConfig(), []);

  const recentTranscript = useMemo(
    () =>
      formatTranscriptForLlm(
        transcript,
        config.suggestionContextWindow,
        config.suggestionTranscriptMaxChars,
      ),
    [config.suggestionContextWindow, config.suggestionTranscriptMaxChars, transcript],
  );

  async function refreshOnce() {
    if (!recentTranscript) return;
    const hash = `${transcript.length}:${recentTranscript.slice(-160)}`;
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    setIsRefreshing(true);
    setRefreshError(null);
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
          maxTranscriptChars: config.suggestionTranscriptMaxChars,
        }),
      });

      const raw = await res.text();
      let json: { suggestions?: unknown; error?: string } = {};
      try {
        json = JSON.parse(raw) as { suggestions?: unknown; error?: string };
      } catch {
        json = {};
      }

      if (!res.ok) {
        setRefreshError(
          typeof json.error === "string"
            ? json.error
            : `Suggestions failed (${res.status}). Check your API key and try Refresh.`,
        );
        return;
      }

      const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
      if (suggestions.length === 0) return;
      if (suggestions.length !== 3) {
        setRefreshError("Suggestions response was invalid. Try Refresh again.");
        return;
      }

      const items = suggestions
        .map((s) => {
          const row = s as { kind?: string; type?: string; preview?: string; text?: string };
          const kindRaw = row.kind ?? row.type ?? "clarification";
          const kind =
            kindRaw === "question" || kindRaw === "insight" || kindRaw === "clarification"
              ? kindRaw
              : "clarification";
          const preview = (row.preview ?? row.text ?? "").trim();
          return {
            id: crypto.randomUUID(),
            kind,
            preview,
            source: "llm" as const,
          };
        })
        .filter((x) => x.preview.length > 0);

      if (items.length !== 3) {
        setRefreshError("Suggestions response was invalid. Try Refresh again.");
        return;
      }

      prependBatch(items as never);
    } catch (e) {
      console.error("[suggestions error]", e);
      setRefreshError(
        e instanceof Error ? e.message : "Could not refresh suggestions. Check your connection.",
      );
    } finally {
      setIsRefreshing(false);
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
      config.chatTranscriptMaxChars,
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
      const history = useAppStore.getState().chat;
      const messages = history
        .filter((m): m is { role: "user" | "assistant"; content: string; id: string; createdAt: string } =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await requestChatCompletion({
        apiKey,
        transcript: transcriptForDetail,
        messages,
        chatPrompt: config.chatPrompt,
        detailPrompt: config.detailPrompt,
        suggestion: { kind: s.kind, preview: s.preview },
        chatHistoryLimit: config.chatMaxMessages,
        transcriptMaxChars: config.chatTranscriptMaxChars,
      });

      if ("error" in result) {
        setSuggestionChatError(result.error);
        return;
      }

      pushChat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setExpandingId(null);
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
