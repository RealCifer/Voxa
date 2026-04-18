import { NextResponse } from "next/server";

import { defaultVoxaConfig } from "@/lib/config";
import {
  GROQ_CHAT_COMPLETIONS_MODEL,
  groqApiKeyFromRequest,
  groqUpstreamErrorSummary,
} from "@/lib/groqServer";
import { dedupeConsecutiveLines } from "@/lib/transcriptFormat";

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

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
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

  const { transcript, prompt, maxTranscriptChars } = (body ?? {}) as {
    transcript?: unknown;
    prompt?: unknown;
    maxTranscriptChars?: unknown;
  };

  if (typeof transcript !== "string") {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const cap = clampInt(
    maxTranscriptChars,
    400,
    8000,
    defaultVoxaConfig.suggestionTranscriptMaxChars,
  );
  const transcriptTrimmed = dedupeConsecutiveLines(transcript.trim()).slice(-cap);
  if (!transcriptTrimmed) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const suggestionPrompt =
    typeof prompt === "string" && prompt.trim()
      ? prompt.trim().slice(0, 1500)
      : "3 concise standalone suggestions to proceed.";

  const system = [
    "Output ONLY JSON: { \"suggestions\": [ { \"kind\": \"question|answer|clarification|fact-check\", \"preview\": \"...\" } ] }",
    "Exactly 3 items. preview ≤140 chars. No extra keys.",
  ].join(" ");

  const user = `Task: ${suggestionPrompt}\nTranscript:\n${transcriptTrimmed}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_CHAT_COMPLETIONS_MODEL,
      temperature: 0.2,
      max_tokens: 200,
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

  return NextResponse.json({
    suggestions: [
      { kind: "clarification", preview: "What’s the desired outcome of this discussion?" },
      { kind: "question", preview: "What’s the next concrete step we should take?" },
      { kind: "fact-check", preview: "Which assumption here is most likely wrong?" },
    ],
  });
}
