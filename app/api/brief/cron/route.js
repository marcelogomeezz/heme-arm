// Brief automático cada mañana (Vercel Cron, ver vercel.json).
import { NextResponse } from "next/server";
import { runBrief } from "../../../../lib/brief-run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = (req.headers.get("user-agent") || "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const b = await runBrief();
    return NextResponse.json({ ok: true, id: b.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
