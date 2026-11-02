import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("heme_session", "", { path: "/", maxAge: 0 });
  return res;
}
