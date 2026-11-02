// Heme ARM — el consejo conversacional: investigan, proponen, debaten y llegan a un consenso.
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDERS } from "./llm";

export const DEFAULT_CONTEXT = `Soy Marcelo Gómez, fundador de Heme Studios (hemestudios.com, Instagram @hemestudios.ai), una consultora de inteligencia artificial con base entre España y Venezuela.
Lo que hacemos: entendemos cómo funciona un negocio y diseñamos e implementamos soluciones de IA a medida (agentes, herramientas internas, automatizaciones, integraciones). Tres servicios: Consultoría y estrategia de IA, Sistemas e implementación, Optimización y crecimiento.
Oferta actual: conversación inicial gratis de 25 minutos → Diagnóstico de IA (precio fundador 290 € / 190 $) → implementación desde 1.500 € / 800 $.
Mercados: España (Madrid) y Venezuela (Caracas), y Latinoamérica.
Mis objetivos, por orden: 1) ganar dinero ya, conseguir los primeros clientes que paguen; 2) crear contenido constante para Instagram, TikTok y estados de WhatsApp; 3) crecer mi marca personal como referente de IA para negocios en español.
Herramientas que uso: Claude, ChatGPT, Grok, Higgsfield (imagen y vídeo), Remotion (motion graphics), ElevenLabs (voz), y este ARM.
Trabajo solo, así que necesito ideas concretas que pueda ejecutar yo mismo con estas herramientas.`;

const RULES = `Responde siempre en español, directo y accionable, sin relleno ni frases genéricas de IA. Prioriza lo que genere dinero o clientes más rápido. Si algo no lo sabes o no lo has podido comprobar, dilo. No inventes datos, cifras de mercado ni casos.`;

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) { const e = new Error("Falta ANTHROPIC_API_KEY en Vercel."); e.status = 400; throw e; }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
const textOf = (content) => content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

async function claudeCall({ system, prompt, max = 1800, web = false }) {
  const client = anthropic();
  let messages = [{ role: "user", content: prompt }];
  const tools = web ? [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }] : undefined;
  let res;
  for (let i = 0; i < 4; i++) {
    res = await client.messages.create({ model: PROVIDERS.claude.model(), max_tokens: max, system, messages, ...(tools ? { tools } : {}) });
    if (res.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: res.content }];
  }
  return textOf(res.content);
}

async function openAICompatible(url, key, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.error?.message || j?.error || `Error ${r.status}`); e.status = r.status; throw e; }
  return (j.choices?.[0]?.message?.content || "").trim();
}

export async function callModel(provider, system, prompt, { search = false } = {}) {
  const p = PROVIDERS[provider];
  const key = process.env[p.env];
  if (!key) { const e = new Error(`${p.name} no tiene clave (${p.env}).`); e.status = 400; throw e; }
  if (provider === "claude") return claudeCall({ system, prompt, web: search });
  const messages = [{ role: "system", content: system }, { role: "user", content: prompt }];
  if (provider === "gpt") return openAICompatible("https://api.openai.com/v1/chat/completions", key, { model: p.model(), messages });
  // Grok: búsqueda en vivo en X y web con la Responses API (herramientas x_search y web_search).
  // Si falla, responde sin búsqueda para no bloquear al consejo.
  if (search) {
    try { return await grokSearch(key, p.model(), messages); } catch (e) { console.error("grok search:", e.message); }
  }
  return openAICompatible("https://api.x.ai/v1/chat/completions", key, { model: p.model(), messages });
}

async function grokSearch(key, model, input) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 150000);
  try {
    const r = await fetch("https://api.x.ai/v1/responses", {
      method: "POST", signal: ctrl.signal,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, input, tools: [{ type: "x_search" }, { type: "web_search" }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error?.message || j.error || `xAI ${r.status}`); e.status = r.status; throw e; }
    const text = j.output_text || (j.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text" || c.type === "text").map((c) => c.text).join("\n").trim();
    if (!text) throw new Error("Grok no devolvió texto");
    return text;
  } finally { clearTimeout(t); }
}

function historyBlock(history = []) {
  if (!history.length) return "";
  return "CONVERSACIÓN PREVIA (lo más reciente al final):\n" + history.slice(-8).map((m) => `${m.role === "user" ? "Marcelo" : "Consejo"}: ${String(m.content).slice(0, 1500)}`).join("\n\n") + "\n\n";
}

// 0 · Investigación (opcional): Claude busca en la web, Grok mira X.
export async function research({ provider, question, context }) {
  const system = `${context}\n\n${RULES}\n\nEres el investigador del consejo de Heme Studios.`;
  const prompt = provider === "grok"
    ? `Busca en X (Twitter) y en la web lo más reciente y relevante para esta pregunta de Marcelo: qué está publicando la gente, qué funciona, qué piden los dueños de negocios, qué hacen cuentas parecidas. Devuelve 5–8 hallazgos concretos, cada uno con su fuente o cuenta si la tienes. Si no puedes buscar en vivo, dilo en la primera línea y responde con lo que sepas.\n\nPREGUNTA: ${question}`
    : `Investiga en internet lo que haga falta para responder bien a esta pregunta de Marcelo (mercado, competencia, tendencias en redes, precios, ejemplos reales). Devuelve 5–8 hallazgos concretos y verificables con su fuente (nombre de la web). Nada de relleno.\n\nPREGUNTA: ${question}`;
  return callModel(provider, system, prompt, { search: true });
}

// 1 · Propuesta independiente
export async function propose({ provider, question, context, history, findings }) {
  const name = PROVIDERS[provider].name;
  const system = `${context}\n\n${RULES}\n\nEres ${name}, uno de los tres miembros del consejo de IA de Heme Studios (Claude, ChatGPT y Grok). Primero das tu propuesta por separado; después debatiréis.`;
  const prompt = `${historyBlock(history)}${findings ? `INVESTIGACIÓN DEL CONSEJO:\n${findings}\n\n` : ""}PREGUNTA DE MARCELO: ${question}\n\nDa tu mejor propuesta: concreta, con pasos, y diciendo por qué es la que más rápido genera dinero o resultados. Máximo 250 palabras. Usa **negritas** para lo clave y listas con guiones.`;
  return callModel(provider, system, prompt);
}

// 2 · Debate: cada uno lee a los otros y mejora
export async function critique({ provider, question, context, proposals }) {
  const name = PROVIDERS[provider].name;
  const others = Object.entries(proposals).filter(([k, v]) => k !== provider && v).map(([k, v]) => `### ${PROVIDERS[k].name}\n${v}`).join("\n\n");
  const system = `${context}\n\n${RULES}\n\nEres ${name} en el consejo de IA de Heme Studios. Estás debatiendo con los otros miembros.`;
  const prompt = `PREGUNTA DE MARCELO: ${question}\n\nTU PROPUESTA:\n${proposals[provider] || "(no respondiste)"}\n\nPROPUESTAS DE TUS COMPAÑEROS:\n${others || "(nadie más respondió)"}\n\nEn máximo 130 palabras: qué es lo mejor de cada propuesta ajena, qué falla, y cómo cambiarías la tuya después de leerlas. Puedes cambiar de opinión si te convencen. Sé honesto, no diplomático.`;
  return callModel(provider, system, prompt);
}

function parseJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(body.slice(a, b + 1)); } catch { return null; }
}

// 3 · Consenso: Claude modera y redacta la respuesta final + propuestas aceptables
export async function consensus({ question, context, history, findings, proposals, critiques }) {
  const block = (obj) => Object.entries(obj || {}).filter(([, v]) => v).map(([k, v]) => `### ${PROVIDERS[k]?.name || k}\n${v}`).join("\n\n");
  const system = `${context}\n\n${RULES}\n\nEres el moderador del consejo de IA de Heme Studios. Tu trabajo es leer la deliberación de Claude, ChatGPT y Grok y redactar UNA respuesta final que represente el acuerdo del consejo, quedándote con las mejores ideas de cada uno.`;
  const prompt = `${historyBlock(history)}${findings ? `INVESTIGACIÓN:\n${findings}\n\n` : ""}PREGUNTA DE MARCELO: ${question}\n\nPROPUESTAS:\n${block(proposals)}\n\nDEBATE:\n${block(critiques)}\n\nResponde SOLO con un bloque \`\`\`json con esta forma:
{
  "answer": "la respuesta final del consejo a Marcelo, en markdown: empieza con la recomendación en una frase en negrita, luego el porqué y los pasos concretos. Máximo 350 palabras. Habla como 'el consejo'.",
  "agreement": "una o dos frases: en qué coincidieron y en qué no",
  "best": "claude | gpt | grok — quién aportó la idea más valiosa",
  "proposals": [
    { "type": "servicio | contenido | tarea | mensaje | campaña", "title": "título corto y accionable", "detail": "qué hacer exactamente, 1-3 frases" }
  ]
}
Incluye entre 2 y 6 propuestas que Marcelo pueda aceptar y ejecutar.`;
  const raw = await claudeCall({ system, prompt, max: 3000 });
  const j = parseJson(raw);
  if (!j || !j.answer) return { answer: raw, agreement: "", best: null, proposals: [] };
  return { answer: j.answer, agreement: j.agreement || "", best: ["claude", "gpt", "grok"].includes(j.best) ? j.best : null, proposals: Array.isArray(j.proposals) ? j.proposals.slice(0, 8) : [] };
}

// Brief diario (newsletter)
export async function brief({ context, stats, plan }) {
  const findingsWeb = await research({ provider: "claude", question: "Novedades de esta semana en inteligencia artificial útiles para pequeñas y medianas empresas; qué contenido sobre IA para negocios está funcionando en Instagram y TikTok en español; nuevas herramientas que un consultor de IA debería conocer.", context }).catch((e) => `(Sin investigación web: ${e.message})`);
  const findingsX = process.env.XAI_API_KEY ? await research({ provider: "grok", question: "Qué se está moviendo hoy en X sobre IA aplicada a negocios, automatización y agentes, sobre todo en español y en EE. UU.", context }).catch(() => "") : "";
  const system = `${context}\n\n${RULES}\n\nEres el editor del brief diario de Heme Studios: una newsletter privada para Marcelo que le dice qué importa hoy y qué hacer para ganar dinero, crear contenido y crecer su marca.`;
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const prompt = `FECHA: ${today}\n\nINVESTIGACIÓN WEB:\n${findingsWeb}\n\n${findingsX ? `LO QUE SE MUEVE EN X:\n${findingsX}\n\n` : ""}ESTADO DEL NEGOCIO:\n${stats}\n\nPLAN ACEPTADO:\n${plan || "(vacío)"}\n\nEscribe el brief de hoy en markdown con estas secciones (títulos con ##):\n## Lo importante hoy\n(3 puntos máximo)\n## Tendencias y oportunidades\n(qué está pasando y cómo aprovecharlo, con fuente)\n## 3 ideas de contenido para hoy\n(gancho + formato de cada una)\n## Foco de ventas\n(qué hacer hoy para conseguir clientes, concreto)\n## Tu plan\n(qué tareas aceptadas tocan y qué está atascado)\n\nMáximo 500 palabras. Directo, sin saludo largo.`;
  return claudeCall({ system, prompt, max: 2500 });
}
