/**
 * Typed access to environment variables (server-safe; avoid NEXT_PUBLIC in secrets).
 * Next.js injects env at build time; dotenv in next.config.ts ensures local .env is available during tooling.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Base URL for browser-side API calls (same origin by default). */
  publicApiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "",
  /** Optional external AI/realtime service URL (server-only). */
  aiServiceUrl: process.env.AI_SERVICE_URL,
  /** Used server-side when calling protected upstream APIs. */
  aiApiKey: process.env.AI_API_KEY,
};

export const serverEnv = {
  /** Call when a secret is mandatory for a route to function. */
  requireAiApiKey: () => required("AI_API_KEY"),
};
