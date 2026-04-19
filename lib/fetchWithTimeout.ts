export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = typeof init.timeoutMs === "number" ? init.timeoutMs : 20_000;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const { timeoutMs: _timeoutMs, signal, ...rest } = init;
    const composedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    return await fetch(input, { ...rest, signal: composedSignal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

