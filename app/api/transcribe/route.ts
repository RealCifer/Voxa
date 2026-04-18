import { NextResponse } from "next/server";

import { groqApiKeyFromRequest } from "@/lib/groqServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const formApiKeyRaw = form.get("groqApiKey");
  const formApiKey = typeof formApiKeyRaw === "string" ? formApiKeyRaw.trim() : "";

  const apiKey = groqApiKeyFromRequest(req, formApiKey);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing Groq API key (set GROQ_API_KEY or AI_API_KEY, or save key in Settings)",
      },
      { status: 401 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing form field: file" },
      { status: 400 },
    );
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name || "chunk.webm");
  upstream.set("model", "whisper-large-v3");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstream,
  });

  const raw = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: "Groq transcription failed", status: res.status, details: raw },
      { status: 502 },
    );
  }

  try {
    const json = JSON.parse(raw) as { text?: string };
    return NextResponse.json({ text: json.text ?? "" });
  } catch {
    return NextResponse.json(
      { error: "Invalid upstream JSON", details: raw },
      { status: 502 },
    );
  }
}

