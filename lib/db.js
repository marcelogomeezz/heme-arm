// Heme ARM — data layer. Postgres (Neon) when DATABASE_URL/POSTGRES_URL is set; in-memory otherwise (local dev).
import { neon } from "@neondatabase/serverless";
import seedLeads from "./seed-leads.json";

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const sql = URL ? neon(URL) : null;
const q = (text, params = []) => (sql.query ? sql.query(text, params) : sql(text, params));

const LEAD_FIELDS = ["name", "sector", "city", "area", "phone", "whatsapp", "email", "instagram", "website", "rating", "reviews", "score", "channel", "signals", "opportunity", "message", "status", "notes", "source", "contacted_at"];

// ---------- in-memory fallback ----------
const mem = globalThis.__hemeMem || (globalThis.__hemeMem = {
  leads: seedLeads.map((l) => normLead(l)),
  ideas: [],
  ideaSeq: 1,
  council: [],
  councilSeq: 1,
});
mem.council = mem.council || []; mem.councilSeq = mem.councilSeq || 1;
for (const k of ["threads", "messages", "plan", "briefs"]) { mem[k] = mem[k] || []; mem[k + "Seq"] = mem[k + "Seq"] || 1; }
mem.settings = mem.settings || {};

function normLead(l) {
  const now = new Date().toISOString();
  return {
    id: l.id || slug(l.name + "-" + (l.area || l.city || "")),
    name: l.name || "Sin nombre",
    sector: l.sector || "",
    city: l.city || "",
    area: l.area || "",
    phone: l.phone || "",
    whatsapp: l.whatsapp || "",
    email: l.email || "",
    instagram: l.instagram || "",
    website: l.website || "",
    rating: l.rating == null || l.rating === "" ? null : Number(l.rating),
    reviews: l.reviews == null || l.reviews === "" ? null : Number(l.reviews),
    score: Number(l.score || 0),
    channel: l.channel || "WhatsApp",
    signals: Array.isArray(l.signals) ? l.signals : [],
    opportunity: l.opportunity || "",
    message: l.message || "",
    status: l.status || "nuevo",
    notes: l.notes || "",
    source: l.source || "Escáner",
    contacted_at: l.contacted_at || null,
    created_at: l.created_at || now,
    updated_at: l.updated_at || now,
  };
}

export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80) || "lead-" + Date.now();
}

// ---------- postgres ----------
let ready = null;
async function ensure() {
  if (!sql) return;
  if (!ready) {
    ready = (async () => {
      await q(`CREATE TABLE IF NOT EXISTS leads (
        id text PRIMARY KEY, name text NOT NULL, sector text, city text, area text, phone text, email text, instagram text, website text,
        rating real, reviews integer, score integer DEFAULT 0, channel text, signals jsonb DEFAULT '[]'::jsonb, opportunity text, message text,
        status text DEFAULT 'nuevo', notes text DEFAULT '', source text, contacted_at timestamptz,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
      await q(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp text`);
      await q(`CREATE TABLE IF NOT EXISTS council (
        id serial PRIMARY KEY, task text, input text, lead_id text, outputs jsonb DEFAULT '{}'::jsonb,
        winner text, fusion text, created_at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS threads (id serial PRIMARY KEY, title text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS messages (id serial PRIMARY KEY, thread_id integer, role text, content text, data jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS plan_items (id serial PRIMARY KEY, type text, title text, detail text, status text DEFAULT 'pendiente', source text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS briefs (id serial PRIMARY KEY, content text, created_at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text)`);
      await q(`CREATE TABLE IF NOT EXISTS ideas (
        id serial PRIMARY KEY, kind text DEFAULT 'contenido', text text NOT NULL, source text DEFAULT 'Marcelo',
        output text, status text DEFAULT 'nueva', created_at timestamptz DEFAULT now())`);
      const c = await q(`SELECT count(*)::int AS n FROM leads`);
      if (c[0].n === 0) await upsertLeadsSql(seedLeads.map(normLead));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

async function upsertLeadsSql(list) {
  for (const l of list) {
    await q(
      `INSERT INTO leads (id,name,sector,city,area,phone,email,instagram,website,rating,reviews,score,channel,signals,opportunity,message,status,notes,source,whatsapp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO NOTHING`,
      [l.id, l.name, l.sector, l.city, l.area, l.phone, l.email, l.instagram, l.website, l.rating, l.reviews, l.score, l.channel, JSON.stringify(l.signals), l.opportunity, l.message, l.status, l.notes, l.source, l.whatsapp]
    );
  }
}

// ---------- public API ----------
export async function listLeads() {
  if (!sql) return [...mem.leads];
  await ensure();
  return q(`SELECT * FROM leads ORDER BY score DESC, reviews DESC NULLS LAST`);
}

export async function addLeads(list) {
  const clean = list.map(normLead);
  if (!sql) {
    const ids = new Set(mem.leads.map((l) => l.id));
    const fresh = clean.filter((l) => !ids.has(l.id));
    mem.leads.push(...fresh);
    return fresh;
  }
  await ensure();
  const existing = new Set((await q(`SELECT id FROM leads`)).map((r) => r.id));
  const fresh = clean.filter((l) => !existing.has(l.id));
  await upsertLeadsSql(fresh);
  return fresh;
}

export async function updateLead(id, patch) {
  const p = {};
  for (const k of LEAD_FIELDS) if (k in patch) p[k] = patch[k];
  if (p.status === "contactado" && !patch.contacted_at) p.contacted_at = new Date().toISOString();
  if (!sql) {
    const l = mem.leads.find((x) => x.id === id);
    if (!l) return null;
    if (p.status === "contactado" && l.contacted_at) delete p.contacted_at;
    Object.assign(l, p, { updated_at: new Date().toISOString() });
    return l;
  }
  await ensure();
  const keys = Object.keys(p);
  if (!keys.length) return (await q(`SELECT * FROM leads WHERE id=$1`, [id]))[0] || null;
  const sets = keys.map((k, i) => (k === "contacted_at" ? `contacted_at = COALESCE(contacted_at, $${i + 2})` : k === "signals" ? `signals = $${i + 2}::jsonb` : `${k} = $${i + 2}`));
  const vals = keys.map((k) => (k === "signals" ? JSON.stringify(p[k]) : p[k]));
  const r = await q(`UPDATE leads SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  return r[0] || null;
}

export async function deleteLead(id) {
  if (!sql) { mem.leads = mem.leads.filter((l) => l.id !== id); return; }
  await ensure();
  await q(`DELETE FROM leads WHERE id=$1`, [id]);
}

export async function listIdeas() {
  if (!sql) return [...mem.ideas].reverse();
  await ensure();
  return q(`SELECT * FROM ideas ORDER BY created_at DESC`);
}

export async function addIdea({ kind = "contenido", text, source = "Marcelo" }) {
  if (!sql) {
    const idea = { id: mem.ideaSeq++, kind, text, source, output: null, status: "nueva", created_at: new Date().toISOString() };
    mem.ideas.push(idea);
    return idea;
  }
  await ensure();
  return (await q(`INSERT INTO ideas (kind,text,source) VALUES ($1,$2,$3) RETURNING *`, [kind, text, source]))[0];
}

export async function updateIdea(id, patch) {
  const allowed = ["kind", "text", "output", "status"];
  const p = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (!sql) {
    const i = mem.ideas.find((x) => x.id === Number(id));
    if (!i) return null;
    Object.assign(i, p);
    return i;
  }
  await ensure();
  const keys = Object.keys(p);
  if (!keys.length) return (await q(`SELECT * FROM ideas WHERE id=$1`, [id]))[0] || null;
  const r = await q(`UPDATE ideas SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(", ")} WHERE id=$1 RETURNING *`, [id, ...keys.map((k) => p[k])]);
  return r[0] || null;
}

export async function deleteIdea(id) {
  if (!sql) { mem.ideas = mem.ideas.filter((i) => i.id !== Number(id)); return; }
  await ensure();
  await q(`DELETE FROM ideas WHERE id=$1`, [id]);
}

// ---------- consejo de IA ----------
export async function listCouncil(limit = 30) {
  if (!sql) return [...mem.council].reverse().slice(0, limit);
  await ensure();
  return q(`SELECT * FROM council ORDER BY created_at DESC LIMIT $1`, [limit]);
}

export async function addCouncil({ task, input, lead_id = null, outputs = {}, winner = null, fusion = null }) {
  if (!sql) {
    const r = { id: mem.councilSeq++, task, input, lead_id, outputs, winner, fusion, created_at: new Date().toISOString() };
    mem.council.push(r); return r;
  }
  await ensure();
  return (await q(`INSERT INTO council (task,input,lead_id,outputs,winner,fusion) VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`, [task, input, lead_id, JSON.stringify(outputs), winner, fusion]))[0];
}

export async function updateCouncil(id, patch) {
  const p = {};
  for (const k of ["outputs", "winner", "fusion"]) if (k in patch) p[k] = patch[k];
  if (!sql) {
    const r = mem.council.find((x) => x.id === Number(id)); if (!r) return null;
    Object.assign(r, p); return r;
  }
  await ensure();
  const keys = Object.keys(p); if (!keys.length) return null;
  const r = await q(`UPDATE council SET ${keys.map((k, i) => k === "outputs" ? `outputs=$${i + 2}::jsonb` : `${k}=$${i + 2}`).join(", ")} WHERE id=$1 RETURNING *`, [id, ...keys.map((k) => (k === "outputs" ? JSON.stringify(p[k]) : p[k]))]);
  return r[0] || null;
}

// ---------- hilos y mensajes ----------
export async function listThreads() {
  if (!sql) return [...mem.threads].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  await ensure();
  return q(`SELECT * FROM threads ORDER BY updated_at DESC LIMIT 60`);
}
export async function createThread(title) {
  const now = new Date().toISOString();
  if (!sql) { const t = { id: mem.threadsSeq++, title, created_at: now, updated_at: now }; mem.threads.push(t); return t; }
  await ensure();
  return (await q(`INSERT INTO threads (title) VALUES ($1) RETURNING *`, [title]))[0];
}
export async function deleteThread(id) {
  if (!sql) { mem.threads = mem.threads.filter((t) => t.id !== Number(id)); mem.messages = mem.messages.filter((m) => m.thread_id !== Number(id)); return; }
  await ensure();
  await q(`DELETE FROM messages WHERE thread_id=$1`, [id]); await q(`DELETE FROM threads WHERE id=$1`, [id]);
}
export async function listMessages(threadId) {
  if (!sql) return mem.messages.filter((m) => m.thread_id === Number(threadId));
  await ensure();
  return q(`SELECT * FROM messages WHERE thread_id=$1 ORDER BY id ASC`, [threadId]);
}
export async function addMessage({ thread_id, role, content, data = {} }) {
  const now = new Date().toISOString();
  if (!sql) {
    const m = { id: mem.messagesSeq++, thread_id: Number(thread_id), role, content, data, created_at: now }; mem.messages.push(m);
    const t = mem.threads.find((x) => x.id === Number(thread_id)); if (t) t.updated_at = now; return m;
  }
  await ensure();
  await q(`UPDATE threads SET updated_at=now() WHERE id=$1`, [thread_id]);
  return (await q(`INSERT INTO messages (thread_id,role,content,data) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`, [thread_id, role, content, JSON.stringify(data)]))[0];
}

// ---------- plan (propuestas aceptadas) ----------
export async function listPlan() {
  if (!sql) return [...mem.plan].reverse();
  await ensure();
  return q(`SELECT * FROM plan_items ORDER BY created_at DESC`);
}
export async function addPlan({ type = "tarea", title, detail = "", source = "" }) {
  const now = new Date().toISOString();
  if (!sql) { const it = { id: mem.planSeq++, type, title, detail, status: "pendiente", source, created_at: now, updated_at: now }; mem.plan.push(it); return it; }
  await ensure();
  return (await q(`INSERT INTO plan_items (type,title,detail,source) VALUES ($1,$2,$3,$4) RETURNING *`, [type, title, detail, source]))[0];
}
export async function updatePlan(id, patch) {
  const p = Object.fromEntries(Object.entries(patch).filter(([k]) => ["type", "title", "detail", "status"].includes(k)));
  if (!sql) { const it = mem.plan.find((x) => x.id === Number(id)); if (!it) return null; Object.assign(it, p, { updated_at: new Date().toISOString() }); return it; }
  await ensure();
  const keys = Object.keys(p); if (!keys.length) return null;
  return (await q(`UPDATE plan_items SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(", ")}, updated_at=now() WHERE id=$1 RETURNING *`, [id, ...keys.map((k) => p[k])]))[0] || null;
}
export async function deletePlan(id) {
  if (!sql) { mem.plan = mem.plan.filter((x) => x.id !== Number(id)); return; }
  await ensure(); await q(`DELETE FROM plan_items WHERE id=$1`, [id]);
}

// ---------- briefs ----------
export async function listBriefs() {
  if (!sql) return [...mem.briefs].reverse();
  await ensure();
  return q(`SELECT * FROM briefs ORDER BY created_at DESC LIMIT 30`);
}
export async function addBrief(content) {
  if (!sql) { const b = { id: mem.briefsSeq++, content, created_at: new Date().toISOString() }; mem.briefs.push(b); return b; }
  await ensure();
  return (await q(`INSERT INTO briefs (content) VALUES ($1) RETURNING *`, [content]))[0];
}

// ---------- ajustes ----------
export async function getSetting(key, fallback = "") {
  if (!sql) return mem.settings[key] ?? fallback;
  await ensure();
  const r = await q(`SELECT value FROM settings WHERE key=$1`, [key]);
  return r[0]?.value ?? fallback;
}
export async function setSetting(key, value) {
  if (!sql) { mem.settings[key] = value; return; }
  await ensure();
  await q(`INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, value]);
}

export const usingDatabase = Boolean(sql);
