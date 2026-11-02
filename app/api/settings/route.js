import { NextResponse } from "next/server";
import { getSetting, setSetting } from "../../../lib/db";
import { DEFAULT_CONTEXT } from "../../../lib/council";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ context: await getSetting("heme_context", DEFAULT_CONTEXT) });
}

export async function PUT(req) {
  const { context } = await req.json().catch(() => ({}));
  if (!context || !context.trim()) return NextResponse.json({ error: "El contexto no puede estar vacío." }, { status: 400 });
  await setSetting("heme_context", context.trim());
  return NextResponse.json({ ok: true });
}
