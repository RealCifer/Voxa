import type { VoxaConfig } from "@/types";

export const VOXA_CONFIG_STORAGE_KEY = "voxa.config.v1";

const defaultSuggestionPrompt = `You are a real-time meeting copilot.
Your job is to generate exactly 3 high-value suggestions based ONLY on the most recent conversation context.
CONTEXT:
{{recent_transcript}}
RULES:
- Return EXACTLY 3 suggestions
- Each suggestion must be SHORT (max 20 words)
- Each suggestion must be immediately useful without clicking
- Suggestions must be diverse:
  - One question to ask
  - One helpful insight or idea
  - One clarification, fact-check, or answer
- Avoid repetition
- Avoid generic advice
- Be specific to the conversation
- Do NOT explain reasoning
OUTPUT:
Return ONLY valid JSON: {"suggestions":[{"type":"question","text":"..."},{"type":"insight","text":"..."},{"type":"clarification","text":"..."}]}
Use type exactly: question, insight, clarification — one of each.`;

export const defaultVoxaConfig: VoxaConfig = {
  suggestionPrompt: defaultSuggestionPrompt,
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

