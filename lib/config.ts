import type { VoxaConfig } from "@/types";

export const VOXA_CONFIG_STORAGE_KEY = "voxa.config.v1";

export const defaultVoxaConfig: VoxaConfig = {
  suggestionPrompt: "Return 3 short, actionable next-step suggestions for this transcript.",
  chatPrompt:
    "Answer clearly and concretely. Use brief bullets when helpful. Ask clarifying questions only if needed.",
  detailPrompt: "Expand with specifics and structure; stay grounded in the transcript.",
  suggestionContextWindow: 10,
  chatContextWindow: 16,
  chatTranscriptMaxChars: 8192,
  suggestionTranscriptMaxChars: 2048,
  chatMaxMessages: 28,
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
      chatTranscriptMaxChars:
        typeof parsed.chatTranscriptMaxChars === "number"
          ? parsed.chatTranscriptMaxChars
          : defaultVoxaConfig.chatTranscriptMaxChars,
      suggestionTranscriptMaxChars:
        typeof parsed.suggestionTranscriptMaxChars === "number"
          ? parsed.suggestionTranscriptMaxChars
          : defaultVoxaConfig.suggestionTranscriptMaxChars,
      chatMaxMessages:
        typeof parsed.chatMaxMessages === "number"
          ? parsed.chatMaxMessages
          : defaultVoxaConfig.chatMaxMessages,
    };
  } catch {
    return defaultVoxaConfig;
  }
}

export function saveVoxaConfig(config: VoxaConfig) {
  if (globalThis.window === undefined) return;
  localStorage.setItem(VOXA_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

