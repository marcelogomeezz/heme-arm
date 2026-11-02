import { NextResponse } from "next/server";
import { listIdeas, addIdea } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ideas: await listIdeas() });
}

export async function POST(req) {
  const { text, kind } = await req.json().catch(() => ({}));
  if (!text || !text.trim()) return NextResponse.json({ error: "Escribe la idea." }, { status: 400 });
  return NextResponse.json({ idea: await addIdea({ text: text.trim(), kind: kind || "contenido" }) });
}
