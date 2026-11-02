import { NextResponse } from "next/server";
import { availability, TASKS } from "../../../lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: availability(), tasks: Object.fromEntries(Object.entries(TASKS).map(([k, t]) => [k, t.label])) });
}
