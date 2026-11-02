import { NextResponse } from "next/server";
import { updateIdea, deleteIdea, listIdeas } from "../../../../lib/db";
import { developIdea } from "../../../../lib/agents";

export const maxDuration = 120;

// PATCH {status|kind|text} edita; PATCH {develop:true} pide al agente que la desarrolle
export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.develop) {
      const idea = (await listIdeas()).find((i) => String(i.id) === String(params.id));
      if (!idea) return NextResponse.json({ error: "Esa idea ya no existe." }, { status: 404 });
      const output = await developIdea({ kind: idea.kind, text: idea.text });
      return NextResponse.json({ idea: await updateIdea(params.id, { output, status: "desarrollada" }) });
    }
    return NextResponse.json({ idea: await updateIdea(params.id, body) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "No se pudo desarrollar la idea." }, { status: e.status || 500 });
  }
}

export async function DELETE(_req, { params }) {
  await deleteIdea(params.id);
  return NextResponse.json({ ok: true });
}
