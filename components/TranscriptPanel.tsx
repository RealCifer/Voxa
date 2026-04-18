"use client";

import { useEffect, useMemo, useRef } from "react";
import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

export function TranscriptPanel() {
  const transcript = useAppStore((s) => s.transcript);
  const isMicActive = useAppStore((s) => s.isMicActive);
  const toggleMic = useAppStore((s) => s.toggleMic);
  const appendTranscript = useAppStore((s) => s.appendTranscript);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const dummyLines = useMemo(
    () => [
      "Testing one two—audio levels look good.",
      "Let’s capture key points as we talk.",
      "We should align on scope and success criteria.",
      "Noting action items as they come up.",
      "Decision pending: timeline vs quality trade-off.",
      "We’ll summarize this at the end.",
    ],
    [],
  );

  useEffect(() => {
    if (!isMicActive) return;

    let i = 0;
    const start = performance.now();
    const id = globalThis.setInterval(() => {
      const now = performance.now();
      appendTranscript({
        id: crypto.randomUUID(),
        text: dummyLines[i % dummyLines.length],
        startMs: Math.max(0, Math.floor(now - start)),
        isFinal: true,
      });
      i += 1;
    }, 1300);

    return () => globalThis.clearInterval(id);
  }, [appendTranscript, dummyLines, isMicActive]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  return (
    <Panel
      title="Transcript"
      aside={
        <button
          type="button"
          onClick={toggleMic}
          className={`rounded border px-2 py-1 text-xs ${
            isMicActive
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
          }`}
          aria-label={isMicActive ? "Stop microphone" : "Start microphone"}
        >
          {isMicActive ? "Stop mic" : "Start mic"}
        </button>
      }
    >
      <div ref={scrollerRef} className="h-full min-h-[12rem] overflow-y-auto pr-1">
        {transcript.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-500">
            Press Start mic to generate dummy transcript segments.
          </p>
        ) : (
          <ul className="space-y-2">
            {transcript.map((seg) => (
              <li
                key={seg.id}
                className="rounded border border-neutral-100 p-2 dark:border-neutral-800"
              >
                <span className="text-xs text-neutral-400">
                  {seg.startMs}ms
                  {seg.isFinal ? " · final" : ""}
                </span>
                <p className="mt-1 whitespace-pre-wrap">{seg.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
