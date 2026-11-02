import { NextResponse } from "next/server";
import { listPlan, addPlan } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: await listPlan() });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!b.title) return NextResponse.json({ error: "Falta el título." }, { status: 400 });
  return NextResponse.json({ item: await addPlan(b) });
}
