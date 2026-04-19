function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function requestDetail(args: {
  apiKey: string | null;
  transcript: string;
  selectedSuggestion: { kind: string; preview: string } | string;
}): Promise<{ answer: string } | { error: string }> {
  const res = await fetch("/api/detail", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(args.apiKey ? { "x-groq-api-key": args.apiKey } : {}),
    },
    body: JSON.stringify({
      transcript: args.transcript,
      selectedSuggestion: args.selectedSuggestion,
    }),
  });

  const raw = await res.text();
  const json = parseJsonObject(raw);
  const errMsg = typeof json.error === "string" ? json.error : null;

  if (!res.ok) {
    let fallback = `Detail request failed (${res.status}). Try again.`;
    if (res.status === 401) fallback = "Not authorized. Check your API key in Settings or server env.";
    if (res.status === 400) fallback = "Invalid detail request.";
    return { error: errMsg ?? fallback };
  }
  if (errMsg) return { error: errMsg };

  const answer = typeof json.answer === "string" ? json.answer.trim() : "";
  if (!answer) return { error: "The model returned an empty detail response. Try again." };
  return { answer };
}

