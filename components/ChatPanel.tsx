"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { requestChatCompletion } from "@/lib/chatClient";
import { loadVoxaConfig } from "@/lib/config";
import { getGroqApiKey } from "@/lib/groqClient";
import { useAppStore } from "@/lib/store/app-store";
import { formatTranscriptForLlm } from "@/lib/transcriptFormat";
import type { ChatMessage } from "@/types";

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z" />
    </svg>
  );
}

function AssistantLoadingBubble() {
  return (
    <div
      className="voxa-fade-in mr-auto max-w-[88%] rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 shadow-md shadow-black/20 backdrop-blur-sm"
      aria-live="polite"
      aria-label="Assistant is replying"
    >
      <div className="mb-3 flex animate-pulse gap-2">
        <div className="h-2.5 w-14 rounded-full bg-zinc-700/80" />
        <div className="h-2.5 w-24 rounded-full bg-zinc-700/55" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="chat-typing-dot inline-block h-2 w-2 rounded-full bg-zinc-400" />
        <span className="chat-typing-dot inline-block h-2 w-2 rounded-full bg-zinc-400" />
        <span className="chat-typing-dot inline-block h-2 w-2 rounded-full bg-zinc-400" />
      </div>
    </div>
  );
}

function MessageBubble({ m }: Readonly<{ m: ChatMessage }>) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="voxa-fade-in max-w-[88%] rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-opacity duration-200">
          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        </div>
      </div>
    );
  }
  if (m.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="voxa-fade-in max-w-[88%] rounded-2xl border border-zinc-800 bg-zinc-900/55 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-md shadow-black/20 backdrop-blur-sm transition-opacity duration-200">
          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center px-1">
      <div className="max-w-[92%] rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-center text-xs leading-relaxed text-zinc-400 shadow-sm backdrop-blur-sm transition-opacity duration-200">
        {m.content}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const chat = useAppStore((s) => s.chat);
  const transcript = useAppStore((s) => s.transcript);
  const pushChat = useAppStore((s) => s.pushChat);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const config = useMemo(() => loadVoxaConfig(), []);
  const transcriptForChat = useMemo(
    () =>
      formatTranscriptForLlm(
        transcript,
        config.chatContextWindow,
        config.chatTranscriptMaxChars,
      ),
    [config.chatContextWindow, config.chatTranscriptMaxChars, transcript],
  );

  const lastMessageId = chat.length > 0 ? chat.at(-1)?.id : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, lastMessageId, isSending]);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending || inFlightRef.current) return;

    const apiKey = getGroqApiKey()?.trim() ?? "";
    if (!apiKey) {
      setSendError("Missing Groq API key. Open Settings, add your key, and save.");
      return;
    }

    inFlightRef.current = true;
    pushChat({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    });
    setDraft("");
    setSendError(null);
    setIsSending(true);

    try {
      const history = useAppStore.getState().chat;
      const messages = history
        .filter((m): m is { role: "user" | "assistant"; content: string; id: string; createdAt: string } =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await requestChatCompletion({
        apiKey,
        transcript: transcriptForChat,
        messages,
        chatPrompt: config.chatPrompt,
        detailPrompt: config.detailPrompt,
        chatHistoryLimit: config.chatMaxMessages,
        transcriptMaxChars: config.chatTranscriptMaxChars,
      });

      if ("error" in result) {
        setSendError(result.error);
        pushChat({
          id: crypto.randomUUID(),
          role: "system",
          content: `Chat request failed. ${result.error}`,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      pushChat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
      inFlightRef.current = false;
    }
  }

  return (
    <Panel title="Chat" bodyClassName="flex min-h-0 flex-col overflow-hidden p-0">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="voxa-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-4 md:px-6">
          {chat.length === 0 && !isSending ? (
            <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 px-2 text-center">
              <p className="text-sm text-zinc-400">Messages appear here.</p>
              <p className="max-w-xs text-xs text-zinc-500">
                Type below or open a suggestion to continue the thread.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {chat.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}
              {isSending ? <AssistantLoadingBubble /> : null}
              <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>

        {sendError ? (
          <div
            className="flex shrink-0 items-start justify-between gap-2 border-t border-zinc-800 bg-zinc-900/40 px-4 py-2 backdrop-blur-sm"
            role="alert"
          >
            <p className="min-w-0 flex-1 text-xs text-red-200">{sendError}</p>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] text-red-200 transition-opacity duration-150 hover:bg-red-950/50"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-zinc-800 bg-zinc-900/55 px-3 pb-3 pt-3 shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl md:px-4">
          <form onSubmit={(e) => void onSubmit(e)} className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-sm text-zinc-100 shadow-inner shadow-black/20 placeholder:text-zinc-500 transition duration-200 focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/25 disabled:opacity-50"
              placeholder="Message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isSending}
              aria-label="Chat message"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="flex shrink-0 items-center justify-center rounded-full border border-blue-500/35 bg-gradient-to-br from-blue-600 to-blue-900 p-2.5 text-white shadow-lg shadow-blue-950/35 transition duration-200 hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              aria-label="Send message"
            >
              {isSending ? (
                <span className="h-[18px] w-[18px] animate-pulse rounded-full bg-white/40" aria-hidden />
              ) : (
                <SendIcon />
              )}
            </button>
          </form>
        </div>
      </div>
    </Panel>
  );
}
