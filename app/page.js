"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// ---------- constantes ----------
const STATUSES = [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["respondio", "Respondió"], ["llamada", "Llamada agendada"], ["propuesta", "Propuesta enviada"], ["cliente", "Cliente"], ["descartado", "Descartado"]];
const SL = Object.fromEntries(STATUSES);
const COLUMNS = [
  { key: "nuevo", label: "Nuevo", match: ["nuevo"] },
  { key: "contactado", label: "Contactado", match: ["contactado"] },
  { key: "conversacion", label: "En conversación", match: ["respondio", "llamada"] },
  { key: "propuesta", label: "Propuesta", match: ["propuesta"] },
  { key: "cliente", label: "Cliente", match: ["cliente"] },
];
const SEATS = [
  { key: "claude", name: "Claude", color: "var(--claude)" },
  { key: "gpt", name: "ChatGPT", color: "var(--gpt)" },
  { key: "grok", name: "Grok", color: "var(--grok)" },
];
const TASK_INFO = {
  implementacion: ["Ideas de implementación", "Las 3 mejores ideas de IA para este negocio"],
  descartar: ["¿Vale la pena?", "Perseguir, esperar o descartar"],
  alternativa: ["Otra puerta de entrada", "Contenido, vídeo, web o algo más pequeño"],
  copy: ["Copy de venta", "Primer mensaje + seguimientos"],
  contenido: ["Guion de contenido", "Un reel a partir del caso"],
  libre: ["Pregunta libre", "Lo que quieras preguntar"],
};
const KINDS = [["contenido", "Contenido"], ["sistema", "Sistema"], ["cliente", "Cliente / nicho"], ["otro", "Otro"]];
const PRESETS = [["clínicas estéticas", "Caracas"], ["concesionarios", "Caracas"], ["restaurantes", "Caracas"], ["inmobiliarias", "Madrid"], ["discotecas", "Madrid"], ["joyerías", "Madrid"]];
const DAY = 86400000;
const WEEK_GOAL = 50;

// ---------- utilidades ----------
const digits = (p) => (p || "").replace(/[^\d]/g, "");
const isMobile = (p) => { const d = digits(p); if (!d) return false; if (d.startsWith("34")) return /^34[67]/.test(d); if (d.startsWith("58")) return /^584/.test(d); return true; };
const waNumber = (l) => (l.whatsapp && digits(l.whatsapp)) ? l.whatsapp : (isMobile(l.phone) ? l.phone : "");
const waLink = (phone, msg) => { const d = digits(phone); return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg || "")}` : null; };
const igLink = (ig) => { if (!ig) return null; if (ig.startsWith("http")) return ig; return `https://instagram.com/${ig.replace(/^@/, "")}`; };
const needsFollowUp = (l) => l.status === "contactado" && l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() > 2 * DAY;
const scoreClass = (s) => (s >= 8 ? "hi" : s >= 6 ? "mid" : "lo");
const leadContext = (l) => [
  `Negocio: ${l.name}`, l.sector && `Sector: ${l.sector}`, (l.area || l.city) && `Ubicación: ${[l.area, l.city].filter(Boolean).join(", ")}`,
  l.rating && `Google: ${l.rating} ★ (${l.reviews || 0} reseñas)`, l.website && `Web: ${l.website}`, l.instagram && `Instagram: ${l.instagram}`,
  l.signals?.length && `Lo que sabemos:\n${l.signals.map((s) => "- " + s.replace(/^!\s*/, "")).join("\n")}`,
  l.opportunity && `Oportunidad detectada: ${l.opportunity}`, l.notes && `Notas de Marcelo: ${l.notes}`,
].filter(Boolean).join("\n");

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function md(text) {
  const lines = esc(text || "").split("\n"); let html = "", inList = false;
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) html += `<h4>${inline(h[1])}</h4>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  if (r.status === 401) { location.href = "/login"; throw new Error("Sesión caducada"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Algo falló. Prueba otra vez.");
  return j;
}

// ---------- iconos ----------
const I = {
  hoy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  pipeline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>,
  scan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M11 8v6M8 11h6" /></svg>,
  council: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="6" cy="8" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="12" cy="6" r="2.5" /><path d="M2.5 18c.6-3 2-4.5 3.5-4.5S9 15 9.5 18M14.5 18c.6-3 2-4.5 3.5-4.5s2.9 1.5 3.5 4.5M8.5 16c.7-3 2-4.5 3.5-4.5s2.8 1.5 3.5 4.5" /></svg>,
  ideas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></svg>,
};
const Logo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><path d="M18 84 V50 a16 16 0 0 1 32 0 V84 M50 50 a16 16 0 0 1 32 0 V84" fill="none" stroke="#EDEBE6" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" /><circle cx="88" cy="20" r="8" fill="#FF5A26" /></svg>
);

// ---------- app ----------
export default function App() {
  const [tab, setTab] = useState("hoy");
  const [leads, setLeads] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [runs, setRuns] = useState([]);
  const [providers, setProviders] = useState(null);
  const [openLead, setOpenLead] = useState(null);
  const [preset, setPreset] = useState(null);
  const [toast, setToast] = useState("");
  const tRef = useRef();
  const say = (t) => { setToast(t); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    api("/api/leads").then((j) => setLeads(j.leads)).catch((e) => { setLeads([]); say(e.message); });
    api("/api/ideas").then((j) => setIdeas(j.ideas)).catch(() => setIdeas([]));
    api("/api/council").then((j) => setRuns(j.runs)).catch(() => {});
    api("/api/providers").then((j) => setProviders(j.providers)).catch(() => {});
  }, []);

  async function patchLead(id, p, msg = "Guardado") {
    try {
      const { lead } = await api(`/api/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(p) });
      setLeads((ls) => ls.map((l) => (l.id === id ? lead : l))); say(msg);
    } catch (e) { say(e.message); }
  }
  function toCouncil(p) { setPreset({ ...p, at: Date.now() }); setOpenLead(null); setTab("council"); }
  async function logout() { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }

  const L = leads || [];
  const hot = L.filter((l) => (l.score || 0) >= 8 && l.status === "nuevo").length;
  const follow = L.filter(needsFollowUp).length;
  const lead = openLead ? L.find((l) => l.id === openLead) : null;
  const nav = [["hoy", "Hoy", I.hoy, follow ? `${follow}` : "", follow > 0], ["pipeline", "Pipeline", I.pipeline, `${L.length || ""}`], ["scan", "Prospectar", I.scan, ""], ["council", "Consejo IA", I.council, ""], ["ideas", "Ideas", I.ideas, `${ideas?.length || ""}`]];

  return (
    <div className="app">
      <aside className="side">
        <div className="logo"><Logo /><b>Heme <em>ARM</em></b></div>
        <nav className="navlist" aria-label="Secciones">
          {nav.map(([k, label, icon, badge, alert]) => (
            <button key={k} className="navbtn" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>
              {icon}<span>{label}</span>{badge && <span className={`badge${alert ? " hot" : ""}`}>{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="models">
            <span className="lbl">Consejo IA</span>
            {SEATS.map((s) => { const p = providers?.[s.key]; return (
              <div key={s.key} className="model-row"><span className={`dot${p?.ready ? "" : " off"}`} style={{ background: s.color }} />{s.name}<span className="st">{p ? (p.ready ? "conectado" : "sin clave") : "…"}</span></div>
            ); })}
          </div>
          <button className="ghost" onClick={logout}>Salir</button>
        </div>
      </aside>

      <main className="main">
        {tab === "hoy" && <Hoy leads={leads} runs={runs} ideas={ideas} hot={hot} follow={follow} open={setOpenLead} go={setTab} />}
        {tab === "pipeline" && <Pipeline leads={leads} open={setOpenLead} go={setTab} />}
        {tab === "scan" && <Scan leads={leads} setLeads={setLeads} go={setTab} />}
        {tab === "council" && <Council leads={L} providers={providers} runs={runs} setRuns={setRuns} preset={preset} say={say} />}
        {tab === "ideas" && <Ideas ideas={ideas} setIdeas={setIdeas} say={say} toCouncil={toCouncil} />}
      </main>

      {lead && <Drawer l={lead} close={() => setOpenLead(null)} patch={patchLead} say={say} toCouncil={toCouncil} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Header({ title, accent, sub, children }) {
  return (
    <div className="top">
      <div><h1 className="title">{title} {accent && <em>{accent}</em>}</h1>{sub && <p className="sub">{sub}</p>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

// ---------- Hoy ----------
function Hoy({ leads, runs, ideas, hot, follow, open, go }) {
  const L = leads || [];
  const h = new Date().getHours();
  const hello = h < 13 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  const weekContacted = L.filter((l) => l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() < 7 * DAY).length;
  const convo = L.filter((l) => ["respondio", "llamada", "propuesta"].includes(l.status)).length;
  const clients = L.filter((l) => l.status === "cliente").length;
  const todo = [
    ...L.filter(needsFollowUp).map((l) => ({ l, why: "Toca seguimiento", tag: "follow" })),
    ...L.filter((l) => l.status === "nuevo").sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6).map((l) => ({ l, why: l.opportunity || "Lead nuevo", tag: "new" })),
  ].slice(0, 7);
  const wins = SEATS.map((s) => ({ ...s, n: runs.filter((r) => r.winner === s.key).length }));
  const maxWins = Math.max(1, ...wins.map((w) => w.n));
  const date = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fade">
      <Header title={hello + ","} accent="Marcelo" sub={`${date.charAt(0).toUpperCase() + date.slice(1)} · lo que mueve el dinero hoy`}>
        <button className="btn" onClick={() => go("scan")}>Prospectar</button>
        <button className="btn primary" onClick={() => go("council")}>Convocar consejo</button>
      </Header>
      <section className="kpis">
        <div className="panel kpi"><span className="lbl">Contactos esta semana</span><b>{weekContacted}<span style={{ fontSize: 20, color: "var(--dim)" }}> / {WEEK_GOAL}</span></b><div className="goal"><i style={{ width: `${Math.min(100, (weekContacted / WEEK_GOAL) * 100)}%` }} /></div></div>
        <div className="panel kpi hot"><span className="lbl">Calientes sin tocar</span><b>{leads ? hot : "–"}</b><small>Score 8 o más</small></div>
        <div className="panel kpi"><span className="lbl">En conversación</span><b>{leads ? convo : "–"}</b><small>{follow ? `${follow} seguimientos pendientes` : "Sin seguimientos pendientes"}</small></div>
        <div className="panel kpi"><span className="lbl">Clientes</span><b>{leads ? clients : "–"}</b><small>Meta: 3 diagnósticos esta semana</small></div>
      </section>
      <div className="hoy-grid">
        <section className="panel todo">
          <div className="row" style={{ marginBottom: 8 }}><span className="lbl">Toca hoy</span><span className="grow" /><button className="btn sm" onClick={() => go("pipeline")}>Ver pipeline</button></div>
          {!leads && <div className="empty"><span className="spin" /> Cargando…</div>}
          {leads && !todo.length && <div className="empty">Nada pendiente. Prospecta nuevos negocios.</div>}
          {todo.map(({ l, why, tag }) => (
            <div key={l.id} className="todo-row" onClick={() => open(l.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(l.id)}>
              <div className={`score ${scoreClass(l.score || 0)}`}>{l.score || 0}</div>
              <div style={{ minWidth: 0 }}><b>{l.name}</b><small>{why}</small></div>
              <span className={`pill${tag === "follow" ? " follow" : ""}`}>{tag === "follow" ? "Seguimiento" : l.sector || "Nuevo"}</span>
            </div>
          ))}
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="panel">
            <span className="lbl">Marcador del consejo</span>
            <div className="board">
              {wins.map((w) => (
                <div key={w.key} className="board-row"><span style={{ color: w.color, fontWeight: 600 }}>{w.name}</span><div className="bar"><i style={{ width: `${(w.n / maxWins) * 100}%`, background: w.color }} /></div><span>{w.n}</span></div>
              ))}
            </div>
            <p className="sub" style={{ fontSize: 13 }}>{runs.length ? `${runs.length} sesiones · gana quien eliges tú` : "Aún no hay sesiones. Convoca la primera."}</p>
          </section>
          <section className="panel">
            <div className="row"><span className="lbl">Ideas recientes</span><span className="grow" /><button className="btn sm" onClick={() => go("ideas")}>Abrir</button></div>
            {(ideas || []).slice(0, 3).map((i) => <p key={i.id} style={{ margin: "10px 0 0", fontSize: 14 }}>· {i.text}</p>)}
            {ideas && !ideas.length && <p className="sub" style={{ fontSize: 13 }}>Sin ideas todavía.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- Pipeline ----------
function Pipeline({ leads, open, go }) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [showLost, setShowLost] = useState(false);
  const L = leads || [];
  const sectors = useMemo(() => [...new Set(L.map((l) => l.sector).filter(Boolean))].sort(), [L]);
  const shown = L.filter((l) => (!sector || l.sector === sector) && (!q || `${l.name} ${l.city} ${l.area}`.toLowerCase().includes(q.toLowerCase())));
  const cols = [...COLUMNS, ...(showLost ? [{ key: "descartado", label: "Descartado", match: ["descartado"] }] : [])];
  return (
    <div className="fade">
      <Header title="Pipeline" sub={`${L.length} leads · toca una tarjeta para ver el detalle y el mensaje`}>
        <button className="btn primary" onClick={() => go("scan")}>+ Prospectar</button>
      </Header>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="chips">
          <button className="chip" aria-pressed={!sector} onClick={() => setSector("")}>Todos</button>
          {sectors.map((s) => <button key={s} className="chip" aria-pressed={sector === s} onClick={() => setSector(s)}>{s}</button>)}
          <button className="chip" aria-pressed={showLost} onClick={() => setShowLost(!showLost)}>Descartados</button>
        </div>
        <span className="grow" />
        <input type="text" style={{ maxWidth: 260 }} placeholder="Buscar negocio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
      </div>
      {!leads ? <div className="empty"><span className="spin" /> Cargando…</div> : (
        <div className="kanban">
          {cols.map((c) => {
            const items = shown.filter((l) => c.match.includes(l.status || "nuevo")).sort((a, b) => (b.score || 0) - (a.score || 0));
            return (
              <section key={c.key} className="col" aria-label={c.label}>
                <div className="col-h"><b>{c.label}</b><span>{items.length}</span></div>
                {items.map((l) => (
                  <button key={l.id} className="kcard" onClick={() => open(l.id)}>
                    <div className={`score ${scoreClass(l.score || 0)}`}>{l.score || 0}</div>
                    <div style={{ minWidth: 0 }}>
                      <b>{l.name}</b>
                      <small>{[l.sector, l.area || l.city].filter(Boolean).join(" · ")}</small>
                      <div className="row">{needsFollowUp(l) && <span className="pill follow">Seguimiento</span>}{l.status !== c.key && c.match.length > 1 && <span className="pill">{SL[l.status]}</span>}</div>
                    </div>
                  </button>
                ))}
                {!items.length && <p className="sub" style={{ fontSize: 13, textAlign: "center", padding: "20px 0" }}>Vacío</p>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Drawer (detalle del lead) ----------
function Drawer({ l, close, patch, say, toCouncil }) {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(l.message || "");
  const [notes, setNotes] = useState(l.notes || "");
  const wa = waLink(waNumber(l), l.message);
  const ig = igLink(l.instagram);
  const landline = l.phone && !isMobile(l.phone);
  useEffect(() => { const k = (e) => e.key === "Escape" && close(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close]);
  const copy = () => navigator.clipboard.writeText(l.message || "").then(() => say("Mensaje copiado"), () => say("No se pudo copiar"));
  const sent = (link) => { window.open(link, "_blank", "noopener"); if (l.status === "nuevo") patch(l.id, { status: "contactado" }, "Marcado como contactado"); };
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label={l.name}>
        <div className="drawer-h">
          <div className={`score ${scoreClass(l.score || 0)}`} style={{ width: 48, height: 48, fontSize: 22 }}>{l.score || 0}</div>
          <div style={{ minWidth: 0 }}>
            <h2>{l.name}</h2>
            <div className="meta">
              {l.sector && <span className="tag">{l.sector}</span>}
              {l.rating ? <span>★ {l.rating} · {Number(l.reviews || 0).toLocaleString("es-ES")} reseñas</span> : null}
              {(l.area || l.city) && <span>{[l.area, l.city].filter(Boolean).join(" · ")}</span>}
              {l.website && <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`} target="_blank" rel="noopener">Web ↗</a>}
              {ig && <a href={ig} target="_blank" rel="noopener">Instagram ↗</a>}
            </div>
          </div>
          <button className="x" onClick={close} aria-label="Cerrar">×</button>
        </div>
        <div className="drawer-b">
          <div className="row">
            <select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })} aria-label="Estado" style={{ maxWidth: 220 }}>
              {STATUSES.map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
            </select>
            {needsFollowUp(l) && <span className="pill follow">Toca seguimiento</span>}
            <span className="grow" />
            <button className="btn sm primary" onClick={() => toCouncil({ leadId: l.id, task: "implementacion" })}>Llevar al consejo</button>
          </div>
          {l.signals?.length > 0 && (
            <div><div className="lbl" style={{ marginBottom: 8 }}>Lo que encontró el escáner</div>
              <ul className="sig">{l.signals.map((x, i) => { const pain = x.startsWith("!"); return <li key={i} className={pain ? "pain" : ""}>{pain ? x.slice(1).trim() : x}</li>; })}</ul></div>
          )}
          {l.opportunity && <div><div className="lbl" style={{ marginBottom: 6 }}>Oportunidad</div><p style={{ margin: 0, color: "var(--muted)" }}>{l.opportunity}</p></div>}
          <div>
            <div className="row" style={{ marginBottom: 8 }}><span className="lbl">Mensaje · {l.channel || "WhatsApp"}</span><span className="grow" /><button className="btn sm" onClick={() => toCouncil({ leadId: l.id, task: "copy" })}>Mejorar con el consejo</button></div>
            {editing ? <textarea className="msg" value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Editar mensaje" /> : <p className="msg">{l.message || "Sin mensaje todavía."}</p>}
            <div className="row" style={{ marginTop: 10 }}>
              {editing ? (<>
                <button className="btn primary sm" onClick={() => { patch(l.id, { message: msg }); setEditing(false); }}>Guardar mensaje</button>
                <button className="btn sm" onClick={() => { setMsg(l.message || ""); setEditing(false); }}>Cancelar</button>
              </>) : (<>
                {wa && <button className="btn primary sm" onClick={() => sent(wa)}>Enviar por WhatsApp ↗</button>}
                {ig && <button className="btn sm" onClick={() => { copy(); sent(ig); }}>Copiar y abrir Instagram ↗</button>}
                {landline && <a className="btn sm" href={`tel:${digits(l.phone)}`}>Llamar</a>}
                <button className="btn sm" onClick={copy}>Copiar</button>
                <button className="btn sm" onClick={() => setEditing(true)}>Editar</button>
              </>)}
            </div>
            {l.phone && <p className="phone" style={{ marginTop: 10 }}>{l.phone}{landline ? " · fijo, sin WhatsApp" : ""}{l.whatsapp && digits(l.whatsapp) !== digits(l.phone) ? ` · WhatsApp ${l.whatsapp}` : ""}</p>}
            {!wa && <input type="text" style={{ marginTop: 8 }} placeholder="¿Encontraste su WhatsApp? Pégalo y pulsa Enter" aria-label="WhatsApp" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) patch(l.id, { whatsapp: e.currentTarget.value.trim() }, "WhatsApp guardado"); }} />}
          </div>
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>Notas</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (l.notes || "") && patch(l.id, { notes })} placeholder="Qué te dijeron, cuándo volver a escribir…" aria-label="Notas" />
            {l.contacted_at && <p className="phone" style={{ marginTop: 8 }}>Contactado el {new Date(l.contacted_at).toLocaleDateString("es-ES")}</p>}
          </div>
        </div>
      </aside>
    </>
  );
}

// ---------- Prospectar ----------
const STEPS = ["Buscando negocios en internet", "Revisando webs e Instagram", "Leyendo reseñas y horarios", "Puntuando oportunidades", "Escribiendo cada primer contacto"];
function Scan({ leads, setLeads, go }) {
  const [niche, setNiche] = useState(""); const [city, setCity] = useState(""); const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false); const [secs, setSecs] = useState(0); const [result, setResult] = useState(null);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [busy]);
  const step = Math.min(STEPS.length - 1, Math.floor(secs / 18));
  async function run(e) {
    e?.preventDefault(); if (!niche || !city) return;
    setBusy(true); setResult(null); setSecs(0);
    try {
      const j = await api("/api/scan", { method: "POST", body: JSON.stringify({ niche, city, count }) });
      setLeads((ls) => [...(ls || []), ...j.leads]);
      setResult({ ok: true, text: `${j.added} negocios nuevos de ${j.found} encontrados. Ya están en Nuevo, con su mensaje.` });
    } catch (e) { setResult({ ok: false, text: e.message }); }
    setBusy(false);
  }
  return (
    <div className="fade">
      <Header title="Prospectar" sub="El agente busca negocios reales, los analiza, los puntúa y escribe un primer contacto para cada uno." />
      <div className="scan">
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <form className="scanform" onSubmit={run}>
            <label><span className="lbl">Nicho</span><input type="text" placeholder="p. ej. clínicas estéticas" value={niche} onChange={(e) => setNiche(e.target.value)} /></label>
            <label><span className="lbl">Ciudad</span><input type="text" placeholder="p. ej. Caracas" value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label><span className="lbl">Cuántos</span><select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 8, 10, 12].map((n) => <option key={n} value={n}>{n} negocios</option>)}</select></label>
            <div style={{ display: "flex", alignItems: "flex-end" }}><button className="btn primary" style={{ width: "100%" }} disabled={busy || !niche || !city}>{busy ? "Escaneando…" : "Escanear"}</button></div>
          </form>
          <div><span className="lbl">Atajos</span><div className="chips" style={{ marginTop: 8 }}>{PRESETS.map(([n, c]) => <button key={n + c} type="button" className="chip" onClick={() => { setNiche(n); setCity(c); }}>{n} · {c}</button>)}</div></div>
          <p className="sub" style={{ fontSize: 13 }}>Tienes {leads ? leads.length : "–"} leads. El escáner salta los que ya existen.</p>
        </section>
        <section className="terminal" aria-live="polite">
          {!busy && !result && <div>$ heme scan <span className="now">--nicho "{niche || "…"}" --ciudad "{city || "…"}"</span><br />Esperando orden.</div>}
          {(busy || result) && STEPS.map((s, i) => (
            <div key={s} className={busy ? (i < step ? "ok" : i === step ? "now" : "") : result?.ok ? "ok" : i <= step ? "ok" : ""}>
              {busy ? (i < step ? "✓" : i === step ? <span className="spin" /> : "·") : "✓"} {s}{busy && i === step ? ` · ${secs}s` : ""}
            </div>
          ))}
          {result && <div className={result.ok ? "ok" : "err"} style={{ marginTop: 12 }}>{result.ok ? "→ " : "✕ "}{result.text}</div>}
          {result?.ok && <button className="btn sm" style={{ marginTop: 12 }} onClick={() => go("pipeline")}>Ver en el pipeline</button>}
        </section>
      </div>
    </div>
  );
}

// ---------- Consejo IA ----------
function Council({ leads, providers, runs, setRuns, preset, say }) {
  const [task, setTask] = useState("implementacion");
  const [leadId, setLeadId] = useState("");
  const [input, setInput] = useState("");
  const [seats, setSeats] = useState({});
  const [run, setRun] = useState(null);
  const [fusion, setFusion] = useState("");
  const [fusing, setFusing] = useState(false);
  const busy = Object.values(seats).some((s) => s.loading);

  useEffect(() => {
    if (!preset) return;
    if (preset.task) setTask(preset.task);
    if (preset.leadId) { setLeadId(preset.leadId); const l = leads.find((x) => x.id === preset.leadId); if (l) setInput(leadContext(l)); }
    if (preset.text) { setLeadId(""); setInput(preset.text); }
    setSeats({}); setRun(null); setFusion("");
  }, [preset?.at]); // eslint-disable-line

  function pickLead(id) { setLeadId(id); const l = leads.find((x) => x.id === id); setInput(l ? leadContext(l) : ""); }

  async function convene() {
    if (!input.trim()) return;
    setFusion(""); setRun(null);
    setSeats(Object.fromEntries(SEATS.map((s) => [s.key, { loading: true }])));
    const results = {};
    await Promise.all(SEATS.map(async (s) => {
      try {
        const j = await api("/api/council/ask", { method: "POST", body: JSON.stringify({ provider: s.key, task, input }) });
        results[s.key] = j.text; setSeats((x) => ({ ...x, [s.key]: { text: j.text, ms: j.ms } }));
      } catch (e) { setSeats((x) => ({ ...x, [s.key]: { error: e.message } })); }
    }));
    try {
      const { run: r } = await api("/api/council", { method: "POST", body: JSON.stringify({ task, input, lead_id: leadId || null, outputs: results }) });
      setRun(r); setRuns((rs) => [r, ...rs]);
    } catch (e) { say(e.message); }
  }
  async function choose(key) {
    if (!run) return;
    try { const { run: r } = await api(`/api/council/${run.id}`, { method: "PATCH", body: JSON.stringify({ winner: key }) }); setRun(r); setRuns((rs) => rs.map((x) => (x.id === r.id ? r : x))); say(`Gana ${SEATS.find((s) => s.key === key).name}`); } catch (e) { say(e.message); }
  }
  async function fuse() {
    setFusing(true);
    try {
      const outputs = Object.fromEntries(Object.entries(seats).filter(([, v]) => v.text).map(([k, v]) => [k, v.text]));
      const j = await api("/api/council/fuse", { method: "POST", body: JSON.stringify({ id: run?.id, task, input, outputs }) });
      setFusion(j.fusion);
    } catch (e) { say(e.message); }
    setFusing(false);
  }
  function reopen(r) {
    setTask(r.task); setInput(r.input); setLeadId(r.lead_id || ""); setRun(r); setFusion(r.fusion || "");
    setSeats(Object.fromEntries(SEATS.map((s) => [s.key, r.outputs?.[s.key] ? { text: r.outputs[s.key] } : { error: "Sin respuesta en esta sesión." }])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const anyText = Object.values(seats).some((s) => s.text);
  const byTask = Object.keys(TASK_INFO).map((t) => ({ t, wins: SEATS.map((s) => runs.filter((r) => r.task === t && r.winner === s.key).length) })).filter((x) => x.wins.some(Boolean));

  return (
    <div className="fade">
      <Header title="Consejo" accent="IA" sub="Claude, ChatGPT y Grok responden a lo mismo. Tú eliges al ganador y el marcador aprende quién es mejor en cada tarea." />
      <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <span className="lbl">1 · Qué necesitas</span>
          <div className="task-grid" style={{ marginTop: 10 }}>
            {Object.entries(TASK_INFO).map(([k, [label, desc]]) => (
              <button key={k} className="task" aria-pressed={task === k} onClick={() => setTask(k)}><b>{label}</b><small>{desc}</small></button>
            ))}
          </div>
        </div>
        <div>
          <span className="lbl">2 · Sobre qué</span>
          <div className="row" style={{ marginTop: 10, alignItems: "stretch" }}>
            <select value={leadId} onChange={(e) => pickLead(e.target.value)} style={{ maxWidth: 340 }} aria-label="Elegir lead">
              <option value="">Texto libre (o elige un lead)</option>
              {[...leads].sort((a, b) => (b.score || 0) - (a.score || 0)).map((l) => <option key={l.id} value={l.id}>{l.score} · {l.name}</option>)}
            </select>
          </div>
          <textarea style={{ marginTop: 10, minHeight: 120 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe el negocio, la idea o lo que quieres preguntar…" aria-label="Contexto" />
        </div>
        <div className="row">
          <button className="btn primary" onClick={convene} disabled={busy || !input.trim()}>{busy ? <><span className="spin" /> El consejo está pensando…</> : "Convocar al consejo"}</button>
          {providers && SEATS.filter((s) => !providers[s.key]?.ready).length > 0 && (
            <span className="sub" style={{ margin: 0, fontSize: 13 }}>Sin clave: {SEATS.filter((s) => !providers[s.key]?.ready).map((s) => s.name).join(", ")}. Añádelas en Vercel para activarlos.</span>
          )}
        </div>
      </section>

      {Object.keys(seats).length > 0 && (
        <div className="council">
          {SEATS.map((s) => {
            const st = seats[s.key] || {}; const win = run?.winner === s.key;
            return (
              <section key={s.key} className={`seat fade${win ? " win" : ""}`} style={{ "--seat": s.color }}>
                <div className="seat-h"><span className="dot" style={{ background: s.color }} /><b>{s.name}</b><small>{providers?.[s.key]?.model || ""}{st.ms ? <><br />{(st.ms / 1000).toFixed(1)} s</> : null}</small></div>
                <div className="seat-b">
                  {st.loading && <div className="shimmer">{[90, 75, 85, 60, 80, 45].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}</div>}
                  {st.error && <p style={{ color: "var(--bad)" }}>{st.error}</p>}
                  {st.text && <div dangerouslySetInnerHTML={{ __html: md(st.text) }} />}
                </div>
                <div className="seat-f">
                  <button className="btn sm" disabled={!st.text || !run} onClick={() => choose(s.key)} style={win ? { borderColor: s.color, color: s.color } : undefined}>{win ? "★ Ganador" : "Elegir esta"}</button>
                  <button className="btn sm" disabled={!st.text} onClick={() => navigator.clipboard.writeText(st.text).then(() => say("Copiado"))}>Copiar</button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {anyText && !busy && (
        <section className="panel fusion fade">
          <div className="row"><span className="lbl" style={{ color: "var(--accent)" }}>Fusión · lo mejor de los tres</span><span className="grow" />
            <button className="btn sm primary" onClick={fuse} disabled={fusing}>{fusing ? <><span className="spin" /> Fusionando…</> : fusion ? "Volver a fusionar" : "Fusionar lo mejor"}</button>
            {fusion && <button className="btn sm" onClick={() => navigator.clipboard.writeText(fusion).then(() => say("Copiado"))}>Copiar</button>}
          </div>
          {fusion ? <div className="seat-b" style={{ padding: "12px 0 0", maxHeight: "none" }} dangerouslySetInnerHTML={{ __html: md(fusion) }} /> : <p className="sub" style={{ fontSize: 13 }}>Claude lee las tres respuestas y crea una versión final con lo mejor de cada una.</p>}
        </section>
      )}

      <div className="hoy-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <span className="lbl">Historial</span>
          <div className="history" style={{ marginTop: 8 }}>
            {!runs.length && <p className="sub" style={{ fontSize: 13 }}>Aquí aparecerá cada sesión del consejo.</p>}
            {runs.slice(0, 12).map((r) => {
              const w = SEATS.find((s) => s.key === r.winner);
              return (
                <button key={r.id} onClick={() => reopen(r)}>
                  <span className="pill">{TASK_INFO[r.task]?.[0] || r.task}</span>
                  <small>{(r.input || "").split("\n")[0]}</small>
                  <span style={{ fontSize: 12, color: w ? w.color : "var(--dim)", fontWeight: 600 }}>{w ? `★ ${w.name}` : "Sin elegir"}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <span className="lbl">Quién gana en cada tarea</span>
          {!byTask.length && <p className="sub" style={{ fontSize: 13 }}>Elige ganadores y aquí verás qué modelo es mejor para cada cosa.</p>}
          {byTask.map(({ t, wins }) => {
            const max = Math.max(...wins); const leader = SEATS[wins.indexOf(max)];
            return (
              <div key={t} style={{ marginTop: 14 }}>
                <div className="row"><b style={{ fontSize: 14 }}>{TASK_INFO[t][0]}</b><span className="grow" /><span style={{ fontSize: 12, color: leader.color, fontWeight: 600 }}>Lidera {leader.name}</span></div>
                <div className="board">{SEATS.map((s, i) => <div key={s.key} className="board-row"><span style={{ color: s.color }}>{s.name}</span><div className="bar"><i style={{ width: `${max ? (wins[i] / max) * 100 : 0}%`, background: s.color }} /></div><span>{wins[i]}</span></div>)}</div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

// ---------- Ideas ----------
function Ideas({ ideas, setIdeas, say, toCouncil }) {
  const [text, setText] = useState(""); const [kind, setKind] = useState("contenido"); const [filter, setFilter] = useState(""); const [working, setWorking] = useState(null);
  const I2 = ideas || []; const label = Object.fromEntries(KINDS);
  async function add(e) { e.preventDefault(); if (!text.trim()) return; try { const { idea } = await api("/api/ideas", { method: "POST", body: JSON.stringify({ text, kind }) }); setIdeas((xs) => [idea, ...(xs || [])]); setText(""); say("Idea guardada"); } catch (e) { say(e.message); } }
  async function develop(id) { setWorking(id); try { const { idea } = await api(`/api/ideas/${id}`, { method: "PATCH", body: JSON.stringify({ develop: true }) }); setIdeas((xs) => xs.map((x) => (x.id === id ? idea : x))); } catch (e) { say(e.message); } setWorking(null); }
  async function remove(id) { try { await api(`/api/ideas/${id}`, { method: "DELETE" }); setIdeas((xs) => xs.filter((x) => x.id !== id)); } catch (e) { say(e.message); } }
  const shown = I2.filter((i) => !filter || i.kind === filter);
  return (
    <div className="fade">
      <Header title="Ideas" sub="Apunta todo: reels, sistemas que viste fuera, nichos, clientes. Desarróllalo con Claude o llévalo al consejo." />
      <section className="panel">
        <form className="ideaform" onSubmit={add}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <textarea placeholder="Ej.: sistema de reservas con señal para discotecas latinas" value={text} onChange={(e) => setText(e.target.value)} aria-label="Idea" />
          <button className="btn primary" disabled={!text.trim()}>Guardar</button>
        </form>
      </section>
      <div className="chips" style={{ marginTop: 16 }}>
        <button className="chip" aria-pressed={!filter} onClick={() => setFilter("")}>Todas · {I2.length}</button>
        {KINDS.map(([v, l]) => <button key={v} className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {!ideas && <div className="empty" style={{ marginTop: 16 }}><span className="spin" /> Cargando…</div>}
      {ideas && !shown.length && <div className="empty" style={{ marginTop: 16 }}>Sin ideas todavía.</div>}
      <div className="ideas">
        {shown.map((i) => (
          <article key={i.id} className="panel idea fade">
            <div className="row"><span className="tag">{label[i.kind] || i.kind}</span>{i.source && i.source !== "Marcelo" && <span className="pill">De {i.source}</span>}<span className="phone">{new Date(i.created_at).toLocaleDateString("es-ES")}</span><span className="grow" /><button className="ghost" onClick={() => remove(i.id)}>Borrar</button></div>
            <p style={{ fontSize: 15 }}>{i.text}</p>
            {i.output && <div className="output">{i.output}</div>}
            <div className="row">
              <button className="btn sm primary" disabled={working === i.id} onClick={() => develop(i.id)}>{working === i.id ? <><span className="spin" /> Desarrollando…</> : i.output ? "Rehacer con Claude" : i.kind === "sistema" ? "Ficha de sistema" : i.kind === "contenido" ? "Convertir en reel" : "Desarrollar"}</button>
              <button className="btn sm" onClick={() => toCouncil({ text: i.text, task: i.kind === "contenido" ? "contenido" : i.kind === "cliente" ? "copy" : "implementacion" })}>Al consejo</button>
              {i.output && <button className="btn sm" onClick={() => navigator.clipboard.writeText(i.output).then(() => say("Copiado"))}>Copiar</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
