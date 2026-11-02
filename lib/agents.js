// Heme ARM — agents powered by Claude (Anthropic API).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export const HEME = `Heme Studios es una consultora que diseña e instala sistemas de IA a medida para negocios: ARM (sistemas de ventas que atienden, califican y hacen seguimiento solos), asistentes de WhatsApp e Instagram, reservas y recordatorios, automatizaciones de papeleo, integraciones y el "cerebro" de la empresa. Web: hemestudios.com. Firma: Marcelo, de Heme Studios. Mercados: España y Latinoamérica (sobre todo Venezuela).`;

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error("Falta la clave de Claude. Añade ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables y vuelve a desplegar.");
    e.status = 400;
    throw e;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function textOf(content) {
  return content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseJsonArray(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const a = body.indexOf("["), b = body.lastIndexOf("]");
  if (a === -1 || b === -1) throw new Error("El agente no devolvió una lista de negocios. Prueba otra vez o con otra ciudad.");
  return JSON.parse(body.slice(a, b + 1));
}

// ---------- Escáner: busca negocios, los analiza y escribe el mensaje ----------
export async function scanBusinesses({ niche, city, count = 8, exclude = [] }) {
  const anthropic = client();
  const n = Math.max(3, Math.min(12, Number(count) || 8));
  const system = `${HEME}

Eres el agente escáner de Heme Studios. Investigas negocios reales en internet (Google Maps, su web, Instagram, reseñas, directorios) y detectas qué se les puede automatizar. Nunca inventas datos: si algo no lo encuentras, déjalo vacío.`;

  const prompt = `Busca ${n} negocios reales de "${niche}" en ${city}. Prioriza negocios independientes con dueño accesible; evita grandes cadenas y franquicias.
${exclude.length ? `No incluyas estos, ya los tenemos: ${exclude.slice(0, 150).join("; ")}.` : ""}

Para cada negocio averigua: nombre, barrio o zona, teléfono (formato internacional), un número de WhatsApp si lo publican (botón o enlace wa.me en su web, Instagram o Google; normalmente un móvil: en España empieza por 6 o 7, en Venezuela por 04), web, Instagram, nota y número de reseñas en Google, horario, si tienen reservas online / formulario / chat / enlace de WhatsApp, y qué se repite en sus reseñas (quejas sobre respuesta lenta, reservas, cobros, citas, papeleo, confusión; o una sola persona que lo hace todo; clientes extranjeros).

Puntúa de 1 a 10 la oportunidad para Heme: dolor visible en reseñas (+3), horario corto o cerrado fines de semana (+2), mucho volumen de clientes (+2), independiente con dueño accesible (+2), sin reservas/chat online (+1). Franquicias o cadenas: máximo 4.

Escribe para cada uno un mensaje de primer contacto en español, cercano, de 5 a 8 líneas: saludo al negocio (o a la persona que nombran las reseñas); "Soy Marcelo, de Heme Studios (hemestudios.com)."; un dato real y concreto que encontraste; qué sistema lo resolvería, en lenguaje de negocio (sin las palabras chatbot, LLM ni agente); y cierra con "¿Te enseño en 15 minutos cómo quedaría?". No cites reseñas ofensivas literalmente, no acuses, no prometas cifras.

Responde SOLO con un bloque \`\`\`json que contenga un array. Cada elemento:
{"name":"", "sector":"(singular, con mayúscula, p. ej. Inmobiliaria)", "city":"", "area":"", "phone":"", "whatsapp":"(solo si lo encontraste publicado; si no, vacío)", "website":"", "instagram":"", "rating":null, "reviews":null, "score":0, "channel":"WhatsApp si hay número de WhatsApp; si solo hay fijo, Llamada; si no hay teléfono, Instagram DM o Email", "signals":["frases cortas; empieza con '! ' las que son un dolor real"], "opportunity":"qué le vendemos, 1-2 frases", "message":"el mensaje completo"}`;

  let messages = [{ role: "user", content: prompt }];
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(30, n * 3) }];
  let res;
  for (let i = 0; i < 4; i++) {
    res = await anthropic.messages.create({ model: MODEL, max_tokens: 16000, system, tools, messages });
    if (res.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: res.content }];
  }
  const leads = parseJsonArray(textOf(res.content));
  return leads.filter((l) => l && l.name).map((l) => ({ ...l, source: "Escáner Heme", status: "nuevo" }));
}

// ---------- Ideas: convierte una idea en algo usable ----------
const IDEA_PROMPTS = {
  contenido: `Convierte esta idea en un reel de Instagram de 30–45 s para la cuenta de Heme Studios (@hemestudios.ai), que habla a dueños de negocios en España y Venezuela. Entrega:
1. GANCHO (primeros 3 segundos, una frase que pare el scroll)
2. GUION a cámara, frase por frase, natural y en español neutro-cercano
3. QUÉ SE VE EN PANTALLA en cada parte (textos grandes, diagramas, capturas del sistema)
4. CTA final (comentar una palabra clave o escribir por WhatsApp)
5. CAPTION listo para pegar (3–5 líneas + 5 hashtags)
6. Versión CARRUSEL en 6 diapositivas (una línea cada una)`,
  sistema: `Convierte esta idea en una ficha de sistema vendible por Heme Studios. Entrega:
1. NOMBRE comercial corto
2. PROBLEMA que resuelve (en palabras del dueño del negocio)
3. PARA QUÉ NEGOCIOS (3–5 nichos concretos)
4. CÓMO FUNCIONA, paso a paso (lo que ve el cliente y lo que pasa por detrás)
5. QUÉ HAY QUE CONECTAR (WhatsApp, Instagram, calendario, hoja de cálculo, etc.)
6. PRECIO orientativo: implementación y mensualidad, para España (€) y Venezuela ($)
7. CÓMO MOSTRARLO EN UN REEL (gancho + demo en 3 escenas)
8. MENSAJE DE VENTA de 4 líneas para mandar a un negocio de ese nicho`,
  cliente: `Esta nota es sobre un posible cliente o nicho. Entrega: a quién contactar y por qué canal, el dolor más probable, qué sistema de Heme le encaja, un mensaje de primer contacto de 5–7 líneas firmado por Marcelo de Heme Studios, y dos seguimientos cortos (día 2 y día 5).`,
  otro: `Ordena esta idea: resúmela en una línea, di si ayuda a conseguir clientes este mes (sí/no y por qué), y da los 3 siguientes pasos concretos.`,
};

export async function developIdea({ kind, text }) {
  const anthropic = client();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `${HEME}\n\nEres el agente de marketing y producto de Heme Studios. Escribes en español, claro y directo, sin relleno ni frases de IA genéricas. Usa texto plano con secciones numeradas.`,
    messages: [{ role: "user", content: `${IDEA_PROMPTS[kind] || IDEA_PROMPTS.otro}\n\nIDEA:\n${text}` }],
  });
  return textOf(res.content).trim();
}
