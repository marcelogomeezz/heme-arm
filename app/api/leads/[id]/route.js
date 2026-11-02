import { NextResponse } from "next/server";
import { updateLead, deleteLead } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  const patch = await req.json().catch(() => ({}));
  const lead = await updateLead(params.id, patch);
  if (!lead) return NextResponse.json({ error: "Ese lead ya no existe." }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(_req, { params }) {
  await deleteLead(params.id);
  return NextResponse.json({ ok: true });
}
