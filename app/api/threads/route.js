import { NextResponse } from "next/server";
import { listThreads, createThread } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ threads: await listThreads() });
}

export async function POST(req) {
  const { title } = await req.json().catch(() => ({}));
  return NextResponse.json({ thread: await createThread((title || "Nueva conversación").slice(0, 120)) });
}
