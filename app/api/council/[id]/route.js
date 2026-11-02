import { NextResponse } from "next/server";
import { updateCouncil } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  const patch = await req.json().catch(() => ({}));
  const run = await updateCouncil(params.id, patch);
  if (!run) return NextResponse.json({ error: "Esa sesión ya no existe." }, { status: 404 });
  return NextResponse.json({ run });
}
