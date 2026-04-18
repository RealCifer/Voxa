"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadVoxaConfig, saveVoxaConfig } from "@/lib/config";
import { GROQ_API_KEY_STORAGE_KEY } from "@/lib/groqClient";
import type { VoxaConfig } from "@/types";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => {
    if (globalThis.window === undefined) return "";
    return localStorage.getItem(GROQ_API_KEY_STORAGE_KEY) ?? "";
  });
  const [config, setConfig] = useState<VoxaConfig>(() => loadVoxaConfig());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const canSave = useMemo(
    () =>
      config.suggestionContextWindow > 0 &&
      config.chatContextWindow > 0 &&
      config.chatTranscriptMaxChars >= 512 &&
      config.suggestionTranscriptMaxChars >= 400 &&
      config.chatMaxMessages >= 4,
    [config],
  );

  function onSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!canSave) return;

    const trimmed = apiKey.trim();
    if (trimmed) localStorage.setItem(GROQ_API_KEY_STORAGE_KEY, trimmed);
    else localStorage.removeItem(GROQ_API_KEY_STORAGE_KEY);

    saveVoxaConfig(config);
    setSavedAt(new Date().toISOString());
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Settings
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Stored locally in your browser.
          </p>
        </div>
        <Link
          href="/"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Back
        </Link>
      </header>

      <form
        onSubmit={onSave}
        className="max-w-3xl space-y-6 rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            Groq API key
          </h2>
          <input
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="text"
            aria-label="Groq API key"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Saved to <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{GROQ_API_KEY_STORAGE_KEY}</code>.
            Leave blank to clear.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            Prompts & context
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Suggestion context window</div>
              <input
                type="number"
                min={1}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={config.suggestionContextWindow}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    suggestionContextWindow: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Chat context window</div>
              <input
                type="number"
                min={1}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={config.chatContextWindow}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    chatContextWindow: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Chat transcript cap (chars)</div>
              <input
                type="number"
                min={512}
                max={32000}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={config.chatTranscriptMaxChars}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    chatTranscriptMaxChars: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Suggestions transcript cap (chars)</div>
              <input
                type="number"
                min={400}
                max={8000}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={config.suggestionTranscriptMaxChars}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    suggestionTranscriptMaxChars: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Chat history messages (max)</div>
              <input
                type="number"
                min={4}
                max={80}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={config.chatMaxMessages}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    chatMaxMessages: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Transcript caps apply after deduplicating repeated lines. Only the last N segments (windows above) are
            included.
          </p>

          <label className="space-y-1">
            <div className="text-xs text-neutral-600 dark:text-neutral-400">Meeting copilot prompt</div>
            <textarea
              className="min-h-[14rem] w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={config.suggestionPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, suggestionPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Use <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{recent_transcript}}"}</code>{" "}
              where the live excerpt should go; the API still enforces JSON with{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">suggestions</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">type</code>, and{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">text</code>.
            </p>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-neutral-600 dark:text-neutral-400">Chat assistant prompt</div>
            <textarea
              className="min-h-[14rem] w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={config.chatPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, chatPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Optional placeholders:{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{recent_transcript}}"}</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{chat_history}}"}</code> (prior user/assistant turns),{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{user_input}}"}</code> (latest user
              message). If none are used, the app uses a compact legacy system prompt and sends the full message list.
            </p>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              Suggestion reply (when user clicks a card)
            </div>
            <textarea
              className="min-h-[14rem] w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={config.detailPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, detailPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Placeholders:{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{recent_transcript}}"}</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">{"{{suggestion}}"}</code> (filled as{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">[kind] text</code>). If you omit both,
              the app falls back to a short system prompt plus this text as an &quot;Expand&quot; line.
            </p>
          </label>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {savedAt ? `Saved at ${savedAt.slice(11, 19)}Z` : "Not saved yet"}
          </div>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
          >
            Save
          </button>
        </div>
      </form>
    </main>
  );
}

