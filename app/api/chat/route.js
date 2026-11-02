// Un paso de la deliberación del consejo. El navegador orquesta los pasos para mostrar el progreso en vivo.
import { NextResponse } from "next/server";
import { research, propose, critique, consensus, DEFAULT_CONTEXT } from "../../../lib/council";
import { getSetting } from "../../../lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { step, provider, question } = body;
  if (!question) return NextResponse.json({ error: "Escribe tu pregunta." }, { status: 400 });
  const context = await getSetting("heme_context", DEFAULT_CONTEXT);
  const t0 = Date.now();
  try {
    let out;
    if (step === "research") out = { text: await research({ provider, question, context }) };
    else if (step === "propose") out = { text: await propose({ provider, question, context, history: body.history, findings: body.findings }) };
    else if (step === "critique") out = { text: await critique({ provider, question, context, proposals: body.proposals || {} }) };
    else if (step === "consensus") out = await consensus({ question, context, history: body.history, findings: body.findings, proposals: body.proposals || {}, critiques: body.critiques || {} });
    else return NextResponse.json({ error: "Paso desconocido." }, { status: 400 });
    return NextResponse.json({ ...out, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "El modelo no respondió." }, { status: e.status && e.status < 600 ? e.status : 500 });
  }
}
