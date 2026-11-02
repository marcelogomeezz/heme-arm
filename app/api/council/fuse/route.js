import { NextResponse } from "next/server";
import { synthesize } from "../../../../lib/llm";
import { updateCouncil } from "../../../../lib/db";

export const maxDuration = 120;

export async function POST(req) {
  const { id, task, input, outputs } = await req.json().catch(() => ({}));
  try {
    const fusion = await synthesize(task, input, outputs || {});
    const run = id ? await updateCouncil(id, { fusion }) : null;
    return NextResponse.json({ fusion, run });
  } catch (e) {
    return NextResponse.json({ error: e.message || "No se pudo fusionar." }, { status: e.status || 500 });
  }
}
