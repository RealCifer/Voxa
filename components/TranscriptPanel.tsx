"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/panels/Panel";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { useAppStore } from "@/lib/store/app-store";
import { getGroqApiKey } from "@/lib/groqClient";

const CHUNK_TIMESLICE_MS = 30_000; // <= 30s per requirement

function MicGlyph({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M8 11v1a4 4 0 008 0v-1M12 19v2M9 21h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

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
    <Panel title="Transcript" bodyClassName="flex min-h-0 flex-col overflow-hidden p-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={isMicActive ? stopRecording : startRecording}
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold shadow-lg transition duration-200 ease-out active:scale-95 ${
              isMicActive
                ? "border-red-500/50 bg-gradient-to-br from-red-600 to-red-950 text-white shadow-red-900/30 ring-4 ring-red-500/20 animate-pulse"
                : "border-zinc-700 bg-zinc-900/55 text-zinc-200 shadow-black/30 backdrop-blur-sm hover:border-zinc-600 hover:bg-zinc-900/80"
            }`}
            aria-label={isMicActive ? "Stop microphone" : "Start microphone"}
          >
            {isMicActive ? (
              <span className="h-3 w-3 rounded-full bg-white shadow-[0_0_0_6px_rgba(254,202,202,0.25)]" />
            ) : (
              <MicGlyph className="text-zinc-200" />
            )}
          </button>
          <p className="text-center text-xs text-zinc-400">
            {isMicActive ? "Tap to stop" : "Tap to record"}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400 shadow-sm backdrop-blur-sm">
          <span>
            {isMicActive ? (
              <span className="font-medium text-zinc-100">
                Listening<span className="animate-pulse">…</span>
              </span>
            ) : (
              <span>Mic idle</span>
            )}
          </span>
          <span className="truncate tabular-nums">
            Chunks <span className="text-zinc-100">{audioChunks.length}</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-100">{statusLabel}</span>
          </span>
        </div>

        {error ? (
          <div
            className="rounded-2xl border border-red-900/55 bg-red-950/35 p-3 text-sm text-red-100 shadow-sm backdrop-blur-sm"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div
          ref={scrollerRef}
          className="voxa-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        >
          {transcript.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 text-sm text-zinc-400 shadow-sm backdrop-blur-sm">
              Start recording. Transcript lines appear here with smooth scroll and fade-in.
            </div>
          ) : (
            <ul className="space-y-3">
              {transcript.map((seg, i) => (
                <li key={seg.id} className="voxa-fade-in">
                  <div
                    className={`max-w-[92%] rounded-xl border p-3 shadow-sm backdrop-blur-sm transition-opacity duration-200 ${
                      i % 2 === 0
                        ? "border-zinc-800 bg-zinc-900/45"
                        : "border-zinc-800/80 bg-zinc-950/35"
                    }`}
                  >
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {formatMs(seg.startMs)}
                      {seg.isFinal ? " · final" : ""}
                    </span>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                      {seg.text}
                    </p>
                  </div>
                </li>
              ))}
              <li aria-hidden="true">
                <div ref={bottomRef} className="h-px" />
              </li>
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
