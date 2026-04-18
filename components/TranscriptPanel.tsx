"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { useAppStore } from "@/lib/store/app-store";

const CHUNK_TIMESLICE_MS = 5_000; // <= 30s for easier testing

export function TranscriptPanel() {
  const transcript = useAppStore((s) => s.transcript);
  const isMicActive = useAppStore((s) => s.isMicActive);
  const setMicActive = useAppStore((s) => s.setMicActive);
  const pushAudioChunk = useAppStore((s) => s.pushAudioChunk);
  const clearAudioChunks = useAppStore((s) => s.clearAudioChunks);
  const audioChunks = useAppStore((s) => s.audioChunks);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    clearAudioChunks();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (e) => {
        if (!e.data || e.data.size === 0) return;

        const chunk = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          mimeType: e.data.type || recorder.mimeType || "audio/webm",
          sizeBytes: e.data.size,
          blob: e.data,
        } as const;

        pushAudioChunk(chunk);

        // Prepare to send to backend later (placeholder):
        // - can POST chunk.blob directly
        // - or wrap in FormData: formData.append("file", new File([blob], "chunk.webm", { type: mimeType }))
        console.log("[audio chunk]", chunk);
      });

      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
      });

      recorder.start(CHUNK_TIMESLICE_MS);
      setMicActive(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to access microphone.";
      setError(message);
      setMicActive(false);
    }
  }

  function stopRecording() {
    setError(null);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setMicActive(false);
  }

  useEffect(() => {
    return () => {
      try {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore
      }
      const stream = streamRef.current;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, []);

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
          onClick={isMicActive ? stopRecording : startRecording}
          className={`rounded border px-2 py-1 text-xs ${
            isMicActive
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
          }`}
          aria-label={isMicActive ? "Stop microphone" : "Start microphone"}
        >
          {isMicActive ? "Stop recording" : "Start recording"}
        </button>
      }
    >
      <div ref={scrollerRef} className="h-full min-h-[12rem] overflow-y-auto pr-1">
        <div className="space-y-3">
          {error ? (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div className="rounded border border-neutral-200 p-2 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            <div className="flex items-center justify-between gap-2">
              <span>
                Status: <span className="font-medium">{isMicActive ? "recording" : "idle"}</span>
              </span>
              <span>
                Chunks: <span className="font-medium">{audioChunks.length}</span>
              </span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Chunking via MediaRecorder timeslice: {CHUNK_TIMESLICE_MS / 1000}s
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Audio chunks (logged as blobs)
            </div>
            {audioChunks.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-500">
                Click Start recording. Each chunk will be logged to the console as a Blob.
              </p>
            ) : (
              <ul className="space-y-2">
                {audioChunks
                  .slice()
                  .reverse()
                  .map((c) => (
                    <li
                      key={c.id}
                      className="rounded border border-neutral-100 p-2 text-sm dark:border-neutral-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-400">
                          {c.createdAt.slice(11, 19)}Z
                        </span>
                        <span className="text-xs text-neutral-400">
                          {(c.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {c.mimeType}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {transcript.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Transcript (placeholder)
              </div>
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
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
