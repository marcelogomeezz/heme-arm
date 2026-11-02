import { NextResponse } from "next/server";
import { sessionToken } from "./lib/session";

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/api/inbox") || pathname.startsWith("/api/brief/cron")) return NextResponse.next();
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next(); // sin contraseña configurada (solo en local)
  const ok = req.cookies.get("heme_session")?.value === (await sessionToken(pw));
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/|favicon|icon).*)"] };
