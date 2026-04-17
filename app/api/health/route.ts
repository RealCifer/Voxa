import { NextResponse } from "next/server";

/** Lightweight health check for deploy probes and client connectivity checks. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "voxa" });
}
