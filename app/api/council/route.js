import { NextResponse } from "next/server";
import { listCouncil, addCouncil } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: await listCouncil(40) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!body.task || !body.input) return NextResponse.json({ error: "Faltan la tarea o el contexto." }, { status: 400 });
  return NextResponse.json({ run: await addCouncil(body) });
}
