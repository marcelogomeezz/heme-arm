import { NextResponse } from "next/server";
import { sessionToken } from "../../../lib/session";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.json({ ok: true });
  if (password !== pw) return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("heme_session", await sessionToken(pw), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return res;
}
