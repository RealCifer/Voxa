import type { VoxaConfig } from "@/types";

export const VOXA_CONFIG_STORAGE_KEY = "voxa.config.v1";

export const defaultVoxaConfig: VoxaConfig = {
  suggestionPrompt:
    "You are an assistant that generates exactly 3 concise suggestions that help the user continue their work.",
  chatPrompt:
    "You are a helpful assistant. Be concise, ask clarifying questions when needed, and propose concrete next steps.",
  detailPrompt:
    "Rewrite the selected content with more detail and clarity while preserving meaning and tone.",
  suggestionContextWindow: 12,
  chatContextWindow: 24,
};

export function loadVoxaConfig(): VoxaConfig {
  if (globalThis.window === undefined) return defaultVoxaConfig;
  const raw = localStorage.getItem(VOXA_CONFIG_STORAGE_KEY);
  if (!raw) return defaultVoxaConfig;
  try {
    const parsed = JSON.parse(raw) as Partial<VoxaConfig>;
    return {
      ...defaultVoxaConfig,
      ...parsed,
      suggestionContextWindow:
        typeof parsed.suggestionContextWindow === "number"
          ? parsed.suggestionContextWindow
          : defaultVoxaConfig.suggestionContextWindow,
      chatContextWindow:
        typeof parsed.chatContextWindow === "number"
          ? parsed.chatContextWindow
          : defaultVoxaConfig.chatContextWindow,
    };
  } catch {
    return defaultVoxaConfig;
  }
}

export function saveVoxaConfig(config: VoxaConfig) {
  if (globalThis.window === undefined) return;
  localStorage.setItem(VOXA_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

