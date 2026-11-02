import { NextResponse } from "next/server";
import { listMessages, addMessage, deleteThread } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  return NextResponse.json({ messages: await listMessages(params.id) });
}

// Guarda un mensaje (de Marcelo o la respuesta final del consejo con su deliberación)
export async function POST(req, { params }) {
  const { role, content, data } = await req.json().catch(() => ({}));
  if (!role || !content) return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
  return NextResponse.json({ message: await addMessage({ thread_id: params.id, role, content, data: data || {} }) });
}

export async function DELETE(_req, { params }) {
  await deleteThread(params.id);
  return NextResponse.json({ ok: true });
}
