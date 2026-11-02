import { NextResponse } from "next/server";
import { updatePlan, deletePlan } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  const item = await updatePlan(params.id, await req.json().catch(() => ({})));
  if (!item) return NextResponse.json({ error: "No existe." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req, { params }) {
  await deletePlan(params.id);
  return NextResponse.json({ ok: true });
}
