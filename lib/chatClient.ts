import { defaultVoxaConfig } from "@/lib/config";

export type ChatApiTurn = { role: "user" | "assistant"; content: string };

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function requestChatCompletion(args: {
  apiKey: string | null;
  transcript: string;
  messages: ChatApiTurn[];
  chatPrompt?: string;
  detailPrompt?: string;
  suggestion?: { kind: string; preview: string };
  chatHistoryLimit?: number;
  transcriptMaxChars?: number;
}): Promise<{ content: string } | { error: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(args.apiKey ? { "x-groq-api-key": args.apiKey } : {}),
    },
    body: JSON.stringify({
      transcript: args.transcript,
      messages: args.messages,
      chatPrompt: args.chatPrompt?.trim() || defaultVoxaConfig.chatPrompt,
      detailPrompt: args.detailPrompt?.trim() || defaultVoxaConfig.detailPrompt,
      suggestion: args.suggestion,
      chatHistoryLimit: args.chatHistoryLimit ?? defaultVoxaConfig.chatMaxMessages,
      transcriptMaxChars: args.transcriptMaxChars ?? defaultVoxaConfig.chatTranscriptMaxChars,
    }),
  });

  const raw = await res.text();
  const json = parseJsonObject(raw);
  const errMsg = typeof json.error === "string" ? json.error : null;

  if (!res.ok) {
    let fallback = `Request failed (${res.status}). Try again.`;
    if (res.status === 401) {
      fallback = "Not authorized. Check your API key in Settings or server env.";
    } else if (res.status === 400) {
      fallback = "Invalid chat request.";
    }
    return { error: errMsg ?? fallback };
  }

  if (errMsg) {
    return { error: errMsg };
  }

  const content = typeof json.content === "string" ? json.content.trim() : "";
  if (!content) {
    return { error: "The model returned an empty reply. Try a shorter question or retry." };
  }

  return { content };
}
