"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { useAppStore } from "@/lib/store/app-store";
import { getGroqApiKey } from "@/lib/groqClient";

const CHUNK_TIMESLICE_MS = 30_000; // <= 30s per requirement

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function TranscriptPanel() {
  const transcript = useAppStore((s) => s.transcript);
  const isMicActive = useAppStore((s) => s.isMicActive);
  const setMicActive = useAppStore((s) => s.setMicActive);
  const pushAudioChunk = useAppStore((s) => s.pushAudioChunk);
  const clearAudioChunks = useAppStore((s) => s.clearAudioChunks);
  const audioChunks = useAppStore((s) => s.audioChunks);
  const appendTranscript = useAppStore((s) => s.appendTranscript);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcribeInFlightCountRef = useRef(0);
  const lastChunkIdRef = useRef<string>("");
  let statusLabel = "idle";
  if (isTranscribing) statusLabel = "transcribing…";
  else if (isMicActive) statusLabel = "listening";

  async function startRecording() {
    setError(null);
    clearAudioChunks();
    chunkIndexRef.current = 0;
    const keyAtStart = getGroqApiKey()?.trim() ?? "";
    if (!keyAtStart) {
      setError("Missing Groq API key. Open Settings, add key, and click Save.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", async (e) => {
        if (!e.data || e.data.size === 0) return;

        const chunk = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          mimeType: e.data.type || recorder.mimeType || "audio/webm",
          sizeBytes: e.data.size,
          blob: e.data,
        } as const;

        pushAudioChunk(chunk);

        try {
          if (lastChunkIdRef.current === chunk.id) return;
          lastChunkIdRef.current = chunk.id;

          transcribeInFlightCountRef.current += 1;
          setIsTranscribing(true);

          const filename = `chunk-${chunkIndexRef.current}.webm`;
          const file = new File([chunk.blob], filename, { type: chunk.mimeType });
          const body = new FormData();
          body.set("file", file);

          const apiKey = getGroqApiKey()?.trim() ?? "";
          if (!apiKey) {
            setError("Missing Groq API key. Open Settings, add key, and click Save.");
            return;
          }
          body.set("groqApiKey", apiKey);
          const res = await fetchWithTimeout("/api/transcribe", {
            method: "POST",
            headers: apiKey ? { "x-api-key": apiKey } : undefined,
            body,
            timeoutMs: 35_000,
          });
          const json = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            const msg = json.error ?? "Transcription request failed";
            if (msg.includes("Missing Groq API key")) {
              setError("Missing Groq API key. Open Settings, add key, and click Save.");
            } else {
              setError(msg);
            }
            return;
          }

          const text = (json.text ?? "").trim();
          if (text) {
            appendTranscript({
              id: crypto.randomUUID(),
              text,
              startMs: chunkIndexRef.current * CHUNK_TIMESLICE_MS,
              isFinal: true,
            });
          } else {
            // Non-fatal: show a minimal fallback instead of silently doing nothing
            setError("Transcription returned empty text. The chunk may have been silent.");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed.");
        } finally {
          chunkIndexRef.current += 1;
          transcribeInFlightCountRef.current = Math.max(0, transcribeInFlightCountRef.current - 1);
          if (transcribeInFlightCountRef.current === 0) setIsTranscribing(false);
        }
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript.length]);

  return (
    <Panel
      title="Transcript"
    >
      <div className="flex h-full min-h-[12rem] flex-col gap-4">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={isMicActive ? stopRecording : startRecording}
            className={`group relative flex w-full max-w-md items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
              isMicActive
                ? "border-red-700/60 bg-red-950/40 text-red-100"
                : "border-zinc-700 bg-zinc-900/40 text-zinc-100 hover:bg-zinc-900/60"
            }`}
            aria-label={isMicActive ? "Stop microphone" : "Start microphone"}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isMicActive ? "bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.12)]" : "bg-zinc-400"
              } ${isMicActive ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            <span>{isMicActive ? "Recording" : "Start recording"}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-400">
          <span>
            {isMicActive ? (
              <span className="text-zinc-100">
                Listening<span className="animate-pulse">…</span>
              </span>
            ) : (
              <span>Mic idle</span>
            )}
          </span>
          <span className="truncate">
            Chunks: <span className="text-zinc-100">{audioChunks.length}</span> · Status:{" "}
            <span className="text-zinc-100">{statusLabel}</span>
          </span>
        </div>

        {error ? (
          <div
            className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          {transcript.length === 0 ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/30 p-4 text-sm text-zinc-400">
              Start recording to capture audio. Transcript entries will appear here as they’re transcribed.
            </div>
          ) : (
            <ul className="space-y-2">
              {transcript.map((seg) => (
                <li key={seg.id} className="voxa-fade-in">
                  <div className="max-w-[92%] rounded-xl border border-zinc-700 bg-zinc-900/35 p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-zinc-400">
                        {formatMs(seg.startMs)}
                        {seg.isFinal ? " · final" : ""}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-100">{seg.text}</p>
                  </div>
                </li>
              ))}
              <li aria-hidden="true">
                <div ref={bottomRef} />
              </li>
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
