import { NextResponse } from "next/server";

import {
  GROQ_CHAT_COMPLETIONS_MODEL,
  groqApiKeyFromRequest,
  groqUpstreamErrorSummary,
} from "@/lib/groqServer";

export const runtime = "nodejs";

type SuggestionKind = "question" | "answer" | "clarification" | "fact-check";

function coerceKind(kind: unknown): SuggestionKind {
  return kind === "question" || kind === "answer" || kind === "clarification" || kind === "fact-check"
    ? kind
    : "clarification";
}

function safePreview(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().replaceAll(/\s+/g, " ").slice(0, 140);
}

export async function POST(req: Request) {
  const apiKey = groqApiKeyFromRequest(req);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing Groq API key (set GROQ_API_KEY or AI_API_KEY, or send x-groq-api-key)",
      },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const { transcript, prompt } = (body ?? {}) as {
    transcript?: unknown;
    prompt?: unknown;
  };

  if (typeof transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const transcriptTrimmed = transcript.trim().slice(0, 2000);
  if (!transcriptTrimmed) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const suggestionPrompt =
    typeof prompt === "string" && prompt.trim()
      ? prompt.trim()
      : "Generate exactly 3 concise, high-value standalone suggestions to help the user proceed.";

  const system = [
    "You generate suggestions for a live workspace.",
    "Return ONLY valid JSON with this exact shape:",
    '{ "suggestions": [ { "kind": "question|answer|clarification|fact-check", "preview": "..." }, ... ] }',
    "Rules:",
    "- suggestions length MUST be exactly 3",
    "- preview MUST be short (<= 140 chars), standalone, high-value",
    "- kind MUST be one of: question, answer, clarification, fact-check",
    "- minimize tokens; do not include explanations or extra keys",
  ].join("\n");

  const user = `Prompt:\n${suggestionPrompt}\n\nRecent transcript:\n${transcriptTrimmed}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_CHAT_COMPLETIONS_MODEL,
      temperature: 0.2,
      max_tokens: 220,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    const summary = groqUpstreamErrorSummary(res.status, raw);
    return NextResponse.json(
      {
        error: `Groq suggestions failed: ${summary}`,
        status: res.status,
        details: raw,
      },
      { status: 502 },
    );
  }

  try {
    const json = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { suggestions?: unknown };
    const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    const normalized = arr
      .slice(0, 3)
      .map((s) => s as { kind?: unknown; preview?: unknown })
      .map((s) => ({
        kind: coerceKind(s.kind),
        preview: safePreview(s.preview),
      }))
      .filter((s) => s.preview.length > 0);

    if (normalized.length === 3) {
      return NextResponse.json({ suggestions: normalized });
    }
  } catch {
    // fall through to strict fallback
  }

  // Strict fallback: always exactly 3, minimal + safe.
  return NextResponse.json({
    suggestions: [
      { kind: "clarification", preview: "What’s the desired outcome of this discussion?" },
      { kind: "question", preview: "What’s the next concrete step we should take?" },
      { kind: "fact-check", preview: "Which assumption here is most likely wrong?" },
    ],
  });
}

