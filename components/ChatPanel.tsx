"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { requestChatCompletion } from "@/lib/chatClient";
import { loadVoxaConfig } from "@/lib/config";
import { getGroqApiKey } from "@/lib/groqClient";
import { useAppStore } from "@/lib/store/app-store";
import { CHAT_TRANSCRIPT_MAX_CHARS, formatTranscriptTail } from "@/lib/transcriptFormat";

export function ChatPanel() {
  const chat = useAppStore((s) => s.chat);
  const transcript = useAppStore((s) => s.transcript);
  const pushChat = useAppStore((s) => s.pushChat);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const config = useMemo(() => loadVoxaConfig(), []);
  const transcriptForChat = useMemo(
    () => formatTranscriptTail(transcript, config.chatContextWindow, CHAT_TRANSCRIPT_MAX_CHARS),
    [config.chatContextWindow, transcript],
  );

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    const apiKey = getGroqApiKey()?.trim() ?? "";
    if (!apiKey) {
      setSendError("Missing Groq API key. Open Settings, add your key, and save.");
      return;
    }

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
      });

      if ("error" in result) {
        setSendError(result.error);
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
    }
  }

  return (
    <Panel title="Chat">
      <div className="flex h-full min-h-[12rem] flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {chat.length === 0 ? (
            <p className="text-neutral-500 dark:text-neutral-500">
              Messages with the assistant will show here. Type below or click a suggestion to start.
            </p>
          ) : (
            chat.map((m) => (
              <div
                key={m.id}
                className={`rounded border px-2 py-1.5 text-sm ${
                  m.role === "user"
                    ? "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <span className="text-xs uppercase text-neutral-400">{m.role}</span>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))
          )}
        </div>
        {sendError ? (
          <p className="shrink-0 text-xs text-red-600 dark:text-red-400" role="alert">
            {sendError}
          </p>
        ) : null}
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex shrink-0 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800"
        >
          <input
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isSending}
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={isSending}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </Panel>
  );
}
