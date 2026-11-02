import { brief, DEFAULT_CONTEXT } from "./council";
import { getSetting, listLeads, listPlan, addBrief } from "./db";

const DAY = 86400000;

export async function runBrief() {
  const context = await getSetting("heme_context", DEFAULT_CONTEXT);
  const leads = await listLeads();
  const plan = await listPlan();
  const week = leads.filter((l) => l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() < 7 * DAY).length;
  const follow = leads.filter((l) => l.status === "contactado" && l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() > 2 * DAY);
  const stats = [
    `Leads totales: ${leads.length}`,
    `Contactados esta semana: ${week} (meta 50)`,
    `En conversación: ${leads.filter((l) => ["respondio", "llamada", "propuesta"].includes(l.status)).length}`,
    `Clientes: ${leads.filter((l) => l.status === "cliente").length}`,
    `Seguimientos pendientes: ${follow.map((l) => l.name).join(", ") || "ninguno"}`,
    `Leads calientes sin tocar: ${leads.filter((l) => (l.score || 0) >= 8 && l.status === "nuevo").map((l) => l.name).slice(0, 6).join(", ") || "ninguno"}`,
  ].join("\n");
  const planText = plan.filter((p) => p.status !== "hecho").slice(0, 15).map((p) => `- [${p.status}] (${p.type}) ${p.title}`).join("\n");
  const content = await brief({ context, stats, plan: planText });
  return addBrief(content);
}
