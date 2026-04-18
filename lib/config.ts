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

const defaultDetailPrompt = `You are an expert meeting assistant.
A user clicked on a suggestion during a live conversation.
CONTEXT:
{{recent_transcript}}
SELECTED SUGGESTION:
{{suggestion}}
TASK:
Provide a clear, detailed, and helpful response.
RULES:
- Be concise but informative
- Use structured explanation if needed
- Stay relevant to conversation
- Do not repeat transcript
- Do not hallucinate unknown facts
STYLE:
- Professional
- Direct
- Actionable

If applicable, include:
- bullet points
- examples
- next steps`;

const defaultChatPrompt = `You are a real-time conversation assistant.
CONTEXT:
{{recent_transcript}}
CHAT HISTORY:
{{chat_history}}
USER QUESTION:
{{user_input}}
RULES:
- Answer clearly and directly
- Use conversation context when relevant
- Keep response concise
- Avoid unnecessary detail`;

export const defaultVoxaConfig: VoxaConfig = {
  suggestionPrompt: defaultSuggestionPrompt,
  chatPrompt: defaultChatPrompt,
  detailPrompt: defaultDetailPrompt,
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

