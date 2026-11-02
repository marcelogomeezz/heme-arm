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
});

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

export const usingDatabase = Boolean(sql);
