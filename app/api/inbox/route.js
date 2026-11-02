// Bandeja de entrada para agentes externos (Grok u otros): POST {token, text, kind}
import { NextResponse } from "next/server";
import { addIdea } from "../../../lib/db";

export async function POST(req) {
  const { token, text, kind, source } = await req.json().catch(() => ({}));
  if (!process.env.INBOX_TOKEN || token !== process.env.INBOX_TOKEN) return NextResponse.json({ error: "Token no válido." }, { status: 401 });
  if (!text) return NextResponse.json({ error: "Falta el texto." }, { status: 400 });
  const idea = await addIdea({ text: String(text).slice(0, 5000), kind: kind || "contenido", source: source || "Grok" });
  return NextResponse.json({ ok: true, id: idea.id });
}
