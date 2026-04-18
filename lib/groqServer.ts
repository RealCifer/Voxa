/**
 * Shared Groq Cloud helpers for API routes.
 * @see https://console.groq.com/docs/models
 */

/** Chat/completions model id as required by Groq (not the short alias). */
export const GROQ_CHAT_COMPLETIONS_MODEL =
  process.env.GROQ_CHAT_MODEL?.trim() || "openai/gpt-oss-120b";

export function groqApiKeyFromRequest(req: Request, formOrHeaderFallback?: string | null): string | null {
  const fromForm = typeof formOrHeaderFallback === "string" ? formOrHeaderFallback.trim() : "";
  return (
    process.env.GROQ_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim() ||
    req.headers.get("x-groq-api-key")?.trim() ||
    (fromForm || null)
  );
}

/** Pull a human-readable message from Groq error JSON when possible. */
export function groqUpstreamErrorSummary(status: number, rawBody: string): string {
  try {
    const j = JSON.parse(rawBody) as { error?: { message?: string } };
    const m = j.error?.message;
    if (typeof m === "string" && m.trim()) return m.trim();
  } catch {
    /* ignore */
  }
  const t = rawBody.trim();
  if (t.length > 0 && t.length <= 400) return t;
  return `Request failed (${status})`;
}
