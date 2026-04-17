"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeSessionState } from "@/types";

export type RealtimeSessionControls = {
  state: RealtimeSessionState;
  lastError: Error | null;
  /** Stub: wire MediaStream + WebSocket / WebRTC here. */
  start: () => void;
  stop: () => void;
};

/**
 * Placeholder hook for future realtime audio ingestion (WebSocket/WebRTC + AudioWorklet).
 * Keeps component code stable while transport is implemented.
 */
export function useRealtimeSession(): RealtimeSessionControls {
  const [state, setState] = useState<RealtimeSessionState>("idle");
  const [lastError] = useState<Error | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const start = useCallback(() => {
    setState("connecting");
    globalThis.setTimeout(() => {
      if (!cancelled.current) setState("active");
    }, 0);
    // Future: open RT connection, attach MediaStream, return cleanup.
  }, []);

  const stop = useCallback(() => {
    setState("idle");
  }, []);

  return { state, lastError, start, stop };
}
