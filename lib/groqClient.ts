export const GROQ_API_KEY_STORAGE_KEY = "voxa.groqApiKey.v1";

export function getGroqApiKey(): string | null {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(GROQ_API_KEY_STORAGE_KEY);
}
