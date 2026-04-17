"use client";

import { useState, type FormEvent } from "react";
import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

export function ChatPanel() {
  const chat = useAppStore((s) => s.chat);
  const pushChat = useAppStore((s) => s.pushChat);
  const [draft, setDraft] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    pushChat({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    });
    setDraft("");
  }

  return (
    <Panel title="Chat">
      <div className="flex h-full min-h-[12rem] flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {chat.length === 0 ? (
            <p className="text-neutral-500 dark:text-neutral-500">
              Messages with the assistant will show here.
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
        <form onSubmit={onSubmit} className="flex shrink-0 gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <input
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Chat message"
          />
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Send
          </button>
        </form>
      </div>
    </Panel>
  );
}
