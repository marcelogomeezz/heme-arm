import { NextResponse } from "next/server";
import { listLeads, addLeads, slug } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ leads: await listLeads() });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo leer la base de datos: " + e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const list = (Array.isArray(body.leads) ? body.leads : [body]).filter((l) => l && l.name);
  if (!list.length) return NextResponse.json({ error: "Falta el nombre del negocio." }, { status: 400 });
  const fresh = await addLeads(list.map((l) => ({ ...l, id: l.id || slug(`${l.name}-${l.area || l.city || ""}`) })));
  return NextResponse.json({ added: fresh.length, leads: fresh });
}
