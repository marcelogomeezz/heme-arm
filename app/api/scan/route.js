import { NextResponse } from "next/server";
import { scanBusinesses } from "../../../lib/agents";
import { listLeads, addLeads, slug } from "../../../lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { niche, city, count } = await req.json().catch(() => ({}));
  if (!niche || !city) return NextResponse.json({ error: "Escribe el nicho y la ciudad." }, { status: 400 });
  try {
    const existing = await listLeads();
    const found = await scanBusinesses({ niche, city, count, exclude: existing.map((l) => l.name) });
    const fresh = await addLeads(found.map((l) => ({ ...l, id: slug(`${l.name}-${l.area || l.city || city}`) })));
    return NextResponse.json({ found: found.length, added: fresh.length, leads: fresh });
  } catch (e) {
    return NextResponse.json({ error: e.message || "El escáner falló. Prueba otra vez." }, { status: e.status || 500 });
  }
}
