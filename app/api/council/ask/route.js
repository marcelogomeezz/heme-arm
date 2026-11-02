import { NextResponse } from "next/server";
import { ask } from "../../../../lib/llm";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { provider, task, input } = await req.json().catch(() => ({}));
  if (!input || !input.trim()) return NextResponse.json({ error: "Escribe el contexto o elige un lead." }, { status: 400 });
  const t0 = Date.now();
  try {
    const text = await ask(provider, task, input);
    return NextResponse.json({ text, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "El modelo no respondió." }, { status: e.status || 500 });
  }
}
