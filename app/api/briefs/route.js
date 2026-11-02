import { NextResponse } from "next/server";
import { listBriefs } from "../../../lib/db";
import { runBrief } from "../../../lib/brief-run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ briefs: await listBriefs() });
}

export async function POST() {
  try {
    return NextResponse.json({ brief: await runBrief() });
  } catch (e) {
    return NextResponse.json({ error: e.message || "No se pudo generar el brief." }, { status: e.status || 500 });
  }
}
