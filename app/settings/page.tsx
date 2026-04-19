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
      config.suggestionSmartSeconds >= 15 &&
      config.suggestionSmartSeconds <= 600 &&
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

  const field =
    "w-full rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 py-2 text-sm text-zinc-100 shadow-inner shadow-black/20 transition duration-200 placeholder:text-zinc-500 focus:border-blue-500/35 focus:outline-none focus:ring-1 focus:ring-blue-500/25";
  const labelMuted = "text-xs text-zinc-400";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-zinc-400";

  return (
    <main className="voxa-scroll flex min-h-dvh flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-400">Stored locally in your browser.</p>
        </div>
        <Link
          href="/"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur-sm transition duration-200 hover:border-zinc-700 hover:bg-zinc-900/75 active:scale-[0.98]"
        >
          Back
        </Link>
      </header>

      <form
        onSubmit={onSave}
        className="max-w-3xl space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg shadow-black/25 backdrop-blur-xl md:p-6"
      >
        <section className="space-y-2">
          <h2 className={sectionTitle}>Groq API key</h2>
          <input
            className={field}
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="text"
            aria-label="Groq API key"
          />
          <p className={`text-xs ${labelMuted}`}>
            Saved to{" "}
            <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">
              {GROQ_API_KEY_STORAGE_KEY}
            </code>
            {". "}
            Leave blank to clear.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={sectionTitle}>Prompts & context</h2>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <div className={labelMuted}>Suggestion context window</div>
              <input
                type="number"
                min={1}
                className={field}
                value={config.suggestionContextWindow}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    suggestionContextWindow: Number(e.target.value),
                  }))
                }
              />
              <p className={`text-[11px] ${labelMuted}`}>Last N transcript segments for fallback text and payload size.</p>
            </label>

            <label className="space-y-1">
              <div className={labelMuted}>Suggestion smart window (sec)</div>
              <input
                type="number"
                min={15}
                max={600}
                className={field}
                value={config.suggestionSmartSeconds}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    suggestionSmartSeconds: Number(e.target.value),
                  }))
                }
              />
              <p className={`text-[11px] ${labelMuted}`}>Timed overlap at the end of the live transcript sent to suggestions (15–600).</p>
            </label>

            <label className="space-y-1">
              <div className={labelMuted}>Chat context window</div>
              <input
                type="number"
                min={1}
                className={field}
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
              <div className={labelMuted}>Chat transcript cap (chars)</div>
              <input
                type="number"
                min={512}
                max={32000}
                className={field}
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
              <div className={labelMuted}>Suggestions transcript cap (chars)</div>
              <input
                type="number"
                min={400}
                max={8000}
                className={field}
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
              <div className={labelMuted}>Chat history messages (max)</div>
              <input
                type="number"
                min={4}
                max={80}
                className={field}
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
          <p className={`text-xs ${labelMuted}`}>
            Transcript caps apply after deduplicating repeated lines. Only the last N segments (windows above) are
            included.
          </p>

          <label className="space-y-1">
            <div className={labelMuted}>Meeting copilot prompt</div>
            <textarea
              className={`min-h-[14rem] ${field}`}
              value={config.suggestionPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, suggestionPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className={`text-xs ${labelMuted}`}>
              Use <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{recent_transcript}}"}</code>{" "}
              where the live excerpt should go; the API still enforces JSON with{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">suggestions</code>,{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">type</code>, and{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">text</code>.
            </p>
          </label>

          <label className="space-y-1">
            <div className={labelMuted}>Chat assistant prompt</div>
            <textarea
              className={`min-h-[14rem] ${field}`}
              value={config.chatPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, chatPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className={`text-xs ${labelMuted}`}>
              Optional placeholders:{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{recent_transcript}}"}</code>,{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{chat_history}}"}</code> (prior user/assistant turns),{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{user_input}}"}</code> (latest user
              message). If none are used, the app uses a compact legacy system prompt and sends the full message list.
            </p>
          </label>

          <label className="space-y-1">
            <div className={labelMuted}>
              Suggestion reply (when user clicks a card)
            </div>
            <textarea
              className={`min-h-[14rem] ${field}`}
              value={config.detailPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, detailPrompt: e.target.value }))}
              spellCheck={false}
            />
            <p className={`text-xs ${labelMuted}`}>
              Placeholders:{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{recent_transcript}}"}</code>,{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{"{{suggestion}}"}</code> (filled as{" "}
              <code className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] text-zinc-300">[kind] text</code>). If you omit both,
              the app falls back to a short system prompt plus this text as an &quot;Expand&quot; line.
            </p>
          </label>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className={`text-xs ${labelMuted}`}>
            {savedAt ? `Saved at ${savedAt.slice(11, 19)}Z` : "Not saved yet"}
          </div>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-2xl border border-blue-500/35 bg-gradient-to-br from-blue-600 to-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition duration-200 hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            Save
          </button>
        </div>
      </form>
    </main>
  );
}

