"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { requestChatCompletion } from "@/lib/chatClient";
import { loadVoxaConfig } from "@/lib/config";
import { getGroqApiKey } from "@/lib/groqClient";
import { useAppStore } from "@/lib/store/app-store";
import { CHAT_TRANSCRIPT_MAX_CHARS, formatFullTranscript } from "@/lib/transcriptFormat";
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

  async function onSuggestionActivate(s: Suggestion) {
    if (expandingId) return;

    const apiKey = getGroqApiKey()?.trim() ?? "";
    if (!apiKey) {
      setSuggestionChatError("Add your Groq API key in Settings to use chat from suggestions.");
      return;
    }

    const fullTranscript = formatFullTranscript(transcript).slice(-CHAT_TRANSCRIPT_MAX_CHARS);
    if (!fullTranscript.trim()) {
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
        transcript: fullTranscript,
        messages,
        chatPrompt: config.chatPrompt,
        detailPrompt: config.detailPrompt,
        suggestion: { kind: s.kind, preview: s.preview },
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
        {suggestionChatError ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {suggestionChatError}
          </p>
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
                  title="Send to chat with full transcript context"
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
