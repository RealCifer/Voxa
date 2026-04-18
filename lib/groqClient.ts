import axios from "axios";

export const GROQ_API_KEY_STORAGE_KEY = "voxa.groqApiKey.v1";

export function getGroqApiKey(): string | null {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem(GROQ_API_KEY_STORAGE_KEY);
}

export function createGroqClient() {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  return axios.create({
    baseURL: "https://api.groq.com/openai/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

