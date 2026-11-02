// Heme ARM — los tres "consejeros": Claude (Anthropic), ChatGPT (OpenAI) y Grok (xAI).
import Anthropic from "@anthropic-ai/sdk";
import { HEME } from "./agents";

export const PROVIDERS = {
  claude: { name: "Claude", env: "ANTHROPIC_API_KEY", model: () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5", console: "console.anthropic.com" },
  gpt: { name: "ChatGPT", env: "OPENAI_API_KEY", model: () => process.env.OPENAI_MODEL || "gpt-5", console: "platform.openai.com" },
  grok: { name: "Grok", env: "XAI_API_KEY", model: () => process.env.XAI_MODEL || "grok-4", console: "console.x.ai" },
};

export function availability() {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, { name: p.name, ready: Boolean(process.env[p.env]), model: p.model(), env: p.env, console: p.console }]));
}

export const TASKS = {
  implementacion: {
    label: "Ideas de implementación",
    prompt: "Propón las 3 mejores ideas de implementación de IA para este negocio. Para cada una: el problema, la solución, el impacto esperado, la dificultad (baja, media o alta) y una frase de cómo se la venderías al dueño. Termina diciendo por cuál empezarías y por qué.",
  },
  descartar: {
    label: "¿Vale la pena?",
    prompt: "Evalúa si este negocio vale la pena para Heme Studios ahora mismo. Da un veredicto claro (PERSEGUIR, ESPERAR o DESCARTAR), 3 razones, el principal riesgo y el siguiente paso concreto.",
  },
  alternativa: {
    label: "Otra puerta de entrada",
    prompt: "Si un sistema de IA no es lo primero que este negocio compraría, propón la mejor puerta de entrada alternativa (por ejemplo contenido, vídeo con IA, web, una automatización pequeña o un diagnóstico). Incluye precio orientativo en € y en $, qué se entrega y cómo lleva después a un proyecto mayor.",
  },
  copy: {
    label: "Copy de venta",
    prompt: "Escribe el mejor primer mensaje para este negocio: máximo 5 líneas, consultivo, sin vender un producto en el primer mensaje, con un dato concreto del negocio y una sola pregunta al final. Usa el español del país del negocio (en Venezuela y Latinoamérica 'ustedes', en España 'vosotros'). Después escribe un seguimiento para el día 2 y otro para el día 5.",
  },
  contenido: {
    label: "Guion de contenido",
    prompt: "Escribe un guion de reel de 30 a 45 segundos para el Instagram de Heme Studios inspirado en este caso: gancho de 3 segundos, guion a cámara frase por frase, qué se ve en pantalla, llamada a la acción y caption con 5 hashtags.",
  },
  libre: { label: "Pregunta libre", prompt: "Responde a la petición." },
};

const SYSTEM = `${HEME}

Formas parte del consejo de IA de Heme Studios: tres modelos responden a la misma petición y Marcelo elige la mejor. Responde en español, directo, accionable y sin relleno. Usa títulos cortos en **negrita** y listas con guiones. Máximo 350 palabras. No inventes datos del negocio que no te den; si falta algo importante, dilo en una línea.`;

function buildPrompt(task, input) {
  const t = TASKS[task] || TASKS.libre;
  return `TAREA: ${t.prompt}\n\nCONTEXTO:\n${input}`;
}

async function openAICompatible(url, key, model, prompt) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Error ${r.status} del proveedor`);
  return (j.choices?.[0]?.message?.content || "").trim();
}

export async function ask(provider, task, input) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error("Proveedor desconocido.");
  const key = process.env[p.env];
  if (!key) {
    const e = new Error(`Falta la clave de ${p.name}. Añade ${p.env} en Vercel → Settings → Environment Variables y vuelve a desplegar.`);
    e.status = 400; throw e;
  }
  const prompt = buildPrompt(task, input);
  const model = p.model();
  if (provider === "claude") {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({ model, max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: prompt }] });
    return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }
  if (provider === "gpt") return openAICompatible("https://api.openai.com/v1/chat/completions", key, model, prompt);
  return openAICompatible("https://api.x.ai/v1/chat/completions", key, model, prompt);
}

export async function synthesize(task, input, outputs) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error("Fusionar usa Claude: falta ANTHROPIC_API_KEY."); e.status = 400; throw e; }
  const anthropic = new Anthropic({ apiKey: key });
  const parts = Object.entries(outputs).filter(([, v]) => v).map(([k, v]) => `### ${PROVIDERS[k]?.name || k}\n${v}`).join("\n\n");
  const res = await anthropic.messages.create({
    model: PROVIDERS.claude.model(), max_tokens: 2000, system: SYSTEM,
    messages: [{ role: "user", content: `${buildPrompt(task, input)}\n\nEstas son las respuestas de los tres modelos:\n\n${parts}\n\nCrea UNA versión final que se quede con lo mejor de cada una, sin repetir. Al final, en una línea, di qué aportó cada modelo.` }],
  });
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}
