import { groqUpstreamErrorSummary } from "@/lib/groqServer";

export const GROQ_API_KEY_STORAGE_KEY = "voxa.groqApiKey.v1";

export const GROQ_OPENAI_BASE = "https://api.groq.com/openai/v1";

export class GroqFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rawBody: string,
  ) {
    super(message);
    this.name = "GroqFetchError";
  }
}

export function getGroqApiKey(): string | null {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(GROQ_API_KEY_STORAGE_KEY);
}

type GroqFetchArgs = {
  endpoint: string;
  apiKey: string;
  body: unknown;
};

/** POST JSON to Groq OpenAI-compatible API; returns parsed response body. */
export async function groqFetch<T = unknown>({ endpoint, apiKey, body }: GroqFetchArgs): Promise<T> {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${GROQ_OPENAI_BASE}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawBody = await res.text();
  let parsed: T;
  try {
    parsed = (rawBody ? JSON.parse(rawBody) : {}) as T;
  } catch {
    throw new GroqFetchError(
      res.ok ? "Invalid JSON in Groq response" : groqUpstreamErrorSummary(res.status, rawBody),
      res.status,
      rawBody,
    );
  }

  if (!res.ok) {
    throw new GroqFetchError(groqUpstreamErrorSummary(res.status, rawBody), res.status, rawBody);
  }

  return parsed;
}
