import { NextResponse } from "next/server";

import { defaultVoxaConfig } from "@/lib/config";
import {
  GROQ_CHAT_COMPLETIONS_MODEL,
  groqApiKeyFromRequest,
  groqUpstreamErrorSummary,
} from "@/lib/groqServer";
import { dedupeConsecutiveLines } from "@/lib/transcriptFormat";

export const runtime = "nodejs";

type SuggestionKind = "question" | "insight" | "clarification";

const PLACEHOLDER = "{{recent_transcript}}";

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function maxWords(text: string, limit: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return w.slice(0, limit).join(" ");
}

function coerceKind(raw: unknown): SuggestionKind {
  const t = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (t === "question") return "question";
  if (t === "insight" || t === "idea" || t === "answer") return "insight";
  if (t === "clarification" || t === "fact-check" || t === "fact_check") return "clarification";
  return "clarification";
}

function suggestionText(item: { text?: unknown; preview?: unknown }): string {
  if (typeof item.text === "string" && item.text.trim()) return item.text.trim();
  if (typeof item.preview === "string") return item.preview.trim();
  return "";
}

function extractRawList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "suggestions" in parsed) {
    const s = (parsed as { suggestions: unknown }).suggestions;
    return Array.isArray(s) ? s : [];
  }
  return [];
}

function buildUserPrompt(template: string, transcript: string): string {
  const trimmedTemplate = template.trim().slice(0, 12_000);
  if (trimmedTemplate.includes(PLACEHOLDER)) {
    return trimmedTemplate.replaceAll(PLACEHOLDER, transcript);
  }
  return `${trimmedTemplate}\n\nCONTEXT:\n${transcript}`;
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

  const template =
    typeof prompt === "string" && prompt.trim()
      ? prompt
      : defaultVoxaConfig.suggestionPrompt;

  const userContent = buildUserPrompt(template, transcriptTrimmed);

  const system = [
    "Meeting copilot. Output ONLY JSON: an object with key suggestions (array of length 3).",
    'Each element: {"type":"question"|"insight"|"clarification","text":"..."}.',
    "Exactly one question, one insight, one clarification. Each text ≤20 words. No prose, no extra keys.",
  ].join(" ");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_CHAT_COMPLETIONS_MODEL,
      temperature: 0.25,
      max_tokens: 320,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
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
    const parsed = JSON.parse(content) as unknown;
    const arr = extractRawList(parsed);

    const normalized = arr
      .slice(0, 3)
      .map((s) => s as { type?: unknown; kind?: unknown; text?: unknown; preview?: unknown })
      .map((s) => ({
        kind: coerceKind(s.type ?? s.kind),
        preview: maxWords(suggestionText(s), 20),
      }))
      .filter((s) => s.preview.length > 0);

    if (normalized.length === 3) {
      return NextResponse.json({ suggestions: normalized });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({
    suggestions: [
      {
        kind: "question" as const,
        preview: "What decision do we need from this meeting before we leave?",
      },
      {
        kind: "insight" as const,
        preview: "Naming one owner per action item would close the loop you’re circling.",
      },
      {
        kind: "clarification" as const,
        preview: "Confirm the deadline everyone just implied—is it end of week or next sprint?",
      },
    ],
  });
}
