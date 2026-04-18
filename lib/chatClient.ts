import { defaultVoxaConfig } from "@/lib/config";

export type ChatApiTurn = { role: "user" | "assistant"; content: string };

export async function requestChatCompletion(args: {
  apiKey: string | null;
  transcript: string;
  messages: ChatApiTurn[];
  chatPrompt?: string;
  detailPrompt?: string;
  suggestion?: { kind: string; preview: string };
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
    }),
  });

  const json = (await res.json()) as { content?: string; error?: string };
  if (!res.ok) {
    return { error: json.error ?? "Chat request failed" };
  }
  return { content: (json.content ?? "").trim() };
}
