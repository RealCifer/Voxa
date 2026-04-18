import { NextResponse } from "next/server";

import { GROQ_OPENAI_BASE } from "@/lib/groqClient";
import { groqApiKeyFromRequest, groqUpstreamErrorSummary } from "@/lib/groqServer";

export const runtime = "nodejs";

function resolveAudioFile(form: FormData): File | null {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) return file;
  const audio = form.get("audio");
  if (audio instanceof File && audio.size > 0) return audio;
  return null;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formApiKeyRaw = form.get("groqApiKey");
  const formApiKey = typeof formApiKeyRaw === "string" ? formApiKeyRaw.trim() : "";

  const apiKey = groqApiKeyFromRequest(req, formApiKey);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key: send header x-api-key (or x-groq-api-key), or set GROQ_API_KEY / AI_API_KEY on the server.",
      },
      { status: 401 },
    );
  }

  const file = resolveAudioFile(form);
  if (!file) {
    return NextResponse.json(
      { error: "Missing audio file: use form field \"file\" or \"audio\"." },
      { status: 400 },
    );
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name || "audio.webm");
  upstream.set("model", "whisper-large-v3");

  const url = `${GROQ_OPENAI_BASE}/audio/transcriptions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  const raw = await res.text();
  if (!res.ok) {
    const summary = groqUpstreamErrorSummary(res.status, raw);
    return NextResponse.json(
      {
        error: `Transcription failed: ${summary}`,
        status: res.status,
        details: raw,
      },
      { status: 502 },
    );
  }

  try {
    const json = JSON.parse(raw) as { text?: string };
    return NextResponse.json({ text: typeof json.text === "string" ? json.text : "" });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from transcription service", details: raw },
      { status: 502 },
    );
  }
}
