"use client";
import { useEffect, useMemo, useState } from "react";

const STATUSES = [
  ["nuevo", "Nuevo"], ["contactado", "Contactado"], ["respondio", "Respondió"], ["llamada", "Llamada agendada"],
  ["propuesta", "Propuesta enviada"], ["cliente", "Cliente"], ["descartado", "Descartado"],
];
const SL = Object.fromEntries(STATUSES);
const KINDS = [["contenido", "Contenido"], ["sistema", "Sistema"], ["cliente", "Cliente / nicho"], ["otro", "Otro"]];
const PRESETS = [
  ["inmobiliarias", "Madrid"], ["discotecas", "Madrid"], ["clínicas estéticas", "Madrid"], ["restaurantes", "Caracas"],
  ["clínicas dentales", "Caracas"], ["concesionarios", "Caracas"], ["gimnasios", "Valencia"], ["barberías", "Caracas"],
];

const DAY = 86400000;
const needsFollowUp = (l) => l.status === "contactado" && l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() > 2 * DAY;
const digits = (p) => (p || "").replace(/[^\d]/g, "");
// Móvil = puede tener WhatsApp. España: +34 6/7. Venezuela: +58 4. Otros países: se asume que sí.
const isMobile = (p) => { const d = digits(p); if (!d) return false; if (d.startsWith("34")) return /^34[67]/.test(d); if (d.startsWith("58")) return /^584/.test(d); return true; };
const waNumber = (l) => (l.whatsapp && digits(l.whatsapp)) ? l.whatsapp : (isMobile(l.phone) ? l.phone : "");
const waLink = (phone, msg) => { const d = digits(phone); return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg || "")}` : null; };
const igLink = (ig) => { if (!ig) return null; if (ig.startsWith("http")) return ig; return `https://instagram.com/${ig.replace(/^@/, "")}`; };

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  if (r.status === 401) { location.href = "/login"; throw new Error("Sesión caducada"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Algo falló. Prueba otra vez.");
  return j;
}

function Logo() {
  return (
    <div className="logo">
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 84 V50 a16 16 0 0 1 32 0 V84 M50 50 a16 16 0 0 1 32 0 V84" fill="none" stroke="#EDEBE6" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/><circle cx="88" cy="20" r="8" fill="#FF5A26"/></svg>
      <b>Heme <em>ARM</em></b>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("leads");
  const [leads, setLeads] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [toast, setToast] = useState("");
  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    api("/api/leads").then((j) => setLeads(j.leads)).catch((e) => { setLeads([]); say(e.message); });
    api("/api/ideas").then((j) => setIdeas(j.ideas)).catch(() => setIdeas([]));
  }, []);

  async function logout() { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }

  return (
    <div className="shell">
      <header className="top">
        <Logo />
        <nav className="tabs" role="tablist">
          {[["leads", "Leads"], ["scan", "Prospectar"], ["ideas", "Ideas"]].map(([k, l]) => (
            <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>Salir</button>
      </header>
      {tab === "leads" && <Leads leads={leads} setLeads={setLeads} say={say} goScan={() => setTab("scan")} />}
      {tab === "scan" && <Scan leads={leads} setLeads={setLeads} say={say} goLeads={() => setTab("leads")} />}
      {tab === "ideas" && <Ideas ideas={ideas} setIdeas={setIdeas} say={say} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ---------------- Leads ----------------
function Leads({ leads, setLeads, say, goScan }) {
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState("");
  const [follow, setFollow] = useState(false);
  const [q, setQ] = useState("");
  const L = leads || [];
  const sectors = useMemo(() => [...new Set(L.map((l) => l.sector).filter(Boolean))].sort(), [L]);
  const followCount = L.filter(needsFollowUp).length;
  const shown = L
    .filter((l) => (!sector || l.sector === sector) && (!status || l.status === status) && (!follow || needsFollowUp(l)))
    .filter((l) => !q || `${l.name} ${l.city} ${l.area}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.reviews || 0) - (a.reviews || 0));

  async function patch(id, p, msg = "Guardado") {
    try {
      const { lead } = await api(`/api/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(p) });
      setLeads((ls) => ls.map((l) => (l.id === id ? lead : l)));
      say(msg);
    } catch (e) { say(e.message); }
  }

  return (
    <>
      <section className="kpis" aria-label="Embudo">
        <div className="kpi"><b>{leads ? L.length : "–"}</b><span>Leads</span></div>
        <div className="kpi hot"><b>{leads ? L.filter((l) => (l.score || 0) >= 8 && l.status === "nuevo").length : "–"}</b><span>Calientes sin tocar</span></div>
        <div className="kpi"><b>{leads ? L.filter((l) => !["nuevo", "descartado"].includes(l.status)).length : "–"}</b><span>Contactados</span></div>
        <div className="kpi"><b>{leads ? L.filter((l) => ["respondio", "llamada", "propuesta"].includes(l.status)).length : "–"}</b><span>En conversación</span></div>
        <div className="kpi"><b>{leads ? L.filter((l) => l.status === "cliente").length : "–"}</b><span>Clientes</span></div>
      </section>

      <div className="filters">
        <button className="chip" aria-pressed={!sector} onClick={() => setSector("")}>Todos</button>
        {sectors.map((s) => <button key={s} className="chip" aria-pressed={sector === s} onClick={() => setSector(s)}>{s}</button>)}
        {followCount > 0 && <button className="chip alert" aria-pressed={follow} onClick={() => setFollow(!follow)}>Seguimiento pendiente · {followCount}</button>}
        <span className="grow" />
        <input type="text" placeholder="Buscar negocio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {!leads && <div className="empty"><span className="spin" />Cargando leads…</div>}
      {leads && !L.length && (
        <div className="empty">Aún no hay leads. <button className="btn primary" onClick={goScan}>Prospectar ahora</button></div>
      )}
      {leads && L.length > 0 && !shown.length && <div className="empty">Ningún lead con estos filtros.</div>}
      <div className="leads">{shown.map((l) => <LeadCard key={l.id} l={l} patch={patch} say={say} />)}</div>
    </>
  );
}

function LeadCard({ l, patch, say }) {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(l.message || "");
  const [notes, setNotes] = useState(l.notes || "");
  const s = l.score || 0;
  const wa = waLink(waNumber(l), l.message);
  const landline = l.phone && !isMobile(l.phone);
  const ig = igLink(l.instagram);

  function copy() {
    navigator.clipboard.writeText(l.message || "").then(() => say("Mensaje copiado"), () => say("No se pudo copiar"));
  }
  function sentVia(link) {
    window.open(link, "_blank", "noopener");
    if (l.status === "nuevo") patch(l.id, { status: "contactado" }, "Marcado como contactado");
  }

  return (
    <article className={`lead${l.status === "descartado" ? " dim" : ""}`}>
      <div className="a">
        <div className="head">
          <div className={`score ${s >= 8 ? "hi" : s >= 6 ? "mid" : "lo"}`}>{s}</div>
          <div style={{ minWidth: 0 }}>
            <h3 className="name">{l.name}</h3>
            <div className="meta">
              {l.sector && <span className="tag">{l.sector}</span>}
              {l.rating ? <span>★ {l.rating} · {Number(l.reviews || 0).toLocaleString("es-ES")} reseñas</span> : null}
              {(l.area || l.city) && <span>{[l.area, l.city].filter(Boolean).join(" · ")}</span>}
              {l.website && <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`} target="_blank" rel="noopener">Web ↗</a>}
              {ig && <a href={ig} target="_blank" rel="noopener">Instagram ↗</a>}
            </div>
          </div>
        </div>
        {l.signals?.length > 0 && (
          <>
            <div className="lbl">Lo que encontró el escáner</div>
            <ul className="sig">
              {l.signals.map((x, i) => { const pain = x.startsWith("!"); return <li key={i} className={pain ? "pain" : ""}>{pain ? x.slice(1).trim() : x}</li>; })}
            </ul>
          </>
        )}
        {l.opportunity && <div className="opp"><strong>Qué le vendemos: </strong>{l.opportunity}</div>}
      </div>
      <div className="b">
        <div className="row"><span className="lbl">Mensaje · {l.channel || "WhatsApp"}</span><span className="grow" />
          {needsFollowUp(l) && <span className="pill follow">Toca seguimiento</span>}
        </div>
        {editing
          ? <textarea className="msg" value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Editar mensaje" />
          : <p className="msg">{l.message}</p>}
        <div className="row">
          {editing ? (
            <>
              <button className="btn primary" onClick={() => { patch(l.id, { message: msg }); setEditing(false); }}>Guardar mensaje</button>
              <button className="btn" onClick={() => { setMsg(l.message || ""); setEditing(false); }}>Cancelar</button>
            </>
          ) : (
            <>
              {wa && <button className="btn primary" onClick={() => sentVia(wa)}>Enviar por WhatsApp ↗</button>}
              {ig && <button className="btn" onClick={() => { copy(); sentVia(ig); }}>Copiar y abrir Instagram ↗</button>}
              <button className="btn" onClick={copy}>Copiar</button>
              <button className="btn" onClick={() => setEditing(true)}>Editar</button>
            </>
          )}
        </div>
        {l.phone && (
          <div className="row">
            <span className="phone">{l.phone}{landline ? " · fijo, sin WhatsApp: llama" : ""}</span>
            {landline && <a className="btn" href={`tel:${digits(l.phone)}`}>Llamar</a>}
          </div>
        )}
        {l.whatsapp && digits(l.whatsapp) !== digits(l.phone) && <span className="phone">WhatsApp: {l.whatsapp}</span>}
        {!wa && (
          <div className="row">
            <input type="text" placeholder="¿Encontraste su WhatsApp? Pégalo aquí" defaultValue="" aria-label={`WhatsApp de ${l.name}`}
              onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) patch(l.id, { whatsapp: e.currentTarget.value.trim() }, "WhatsApp guardado"); }} />
            <span className="phone">Enter para guardar</span>
          </div>
        )}
        <div className="row">
          <select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })} aria-label={`Estado de ${l.name}`}>
            {STATUSES.map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
          </select>
          {l.contacted_at && <span className="phone">Contactado el {new Date(l.contacted_at).toLocaleDateString("es-ES")}</span>}
        </div>
        <textarea className="notes" placeholder="Notas: qué te dijeron, cuándo volver a escribir…" value={notes}
          onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (l.notes || "") && patch(l.id, { notes })} aria-label={`Notas de ${l.name}`} />
      </div>
    </article>
  );
}

// ---------------- Prospectar ----------------
function Scan({ leads, setLeads, say, goLeads }) {
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [secs, setSecs] = useState(0);

  useEffect(() => { if (!busy) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [busy]);

  async function run(e) {
    e?.preventDefault();
    if (!niche || !city) return;
    setBusy(true); setResult(null); setSecs(0);
    try {
      const j = await api("/api/scan", { method: "POST", body: JSON.stringify({ niche, city, count }) });
      setLeads((ls) => [...(ls || []), ...j.leads]);
      setResult({ ok: true, text: `Listo: ${j.added} negocios nuevos de ${j.found} encontrados. Ya están en Leads con su mensaje.` });
    } catch (e) { setResult({ ok: false, text: e.message }); }
    setBusy(false);
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2 className="h2">Prospectar</h2>
      <p className="sub">El agente busca negocios reales, revisa su web, reseñas y horario, los puntúa y escribe un mensaje para cada uno. Tarda entre 1 y 4 minutos.</p>
      <form className="scanform" onSubmit={run}>
        <input type="text" placeholder="Nicho (p. ej. inmobiliarias)" value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Nicho" />
        <input type="text" placeholder="Ciudad (p. ej. Caracas)" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad" />
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Cuántos negocios">
          {[5, 8, 10, 12].map((n) => <option key={n} value={n}>{n} negocios</option>)}
        </select>
        <button className="btn primary" disabled={busy || !niche || !city}>{busy ? "Escaneando…" : "Escanear"}</button>
      </form>
      <div className="presets">
        {PRESETS.map(([n, c]) => <button key={n + c} className="chip" type="button" onClick={() => { setNiche(n); setCity(c); }}>{n} · {c}</button>)}
      </div>
      {busy && <p className="status"><span className="spin" />Buscando y analizando negocios… {secs}s</p>}
      {result && (
        <p className={`status ${result.ok ? "ok" : "err"}`}>
          {result.text} {result.ok && <button className="btn" onClick={goLeads}>Ver leads</button>}
        </p>
      )}
      <p className="sub" style={{ marginTop: 18, marginBottom: 0 }}>Tienes {leads ? leads.length : "–"} leads guardados. El escáner salta los que ya tienes.</p>
    </section>
  );
}

// ---------------- Ideas ----------------
function Ideas({ ideas, setIdeas, say }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("contenido");
  const [filter, setFilter] = useState("");
  const [working, setWorking] = useState(null);
  const I = ideas || [];

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { idea } = await api("/api/ideas", { method: "POST", body: JSON.stringify({ text, kind }) });
      setIdeas((xs) => [idea, ...(xs || [])]); setText(""); say("Idea guardada");
    } catch (e) { say(e.message); }
  }
  async function develop(id) {
    setWorking(id);
    try {
      const { idea } = await api(`/api/ideas/${id}`, { method: "PATCH", body: JSON.stringify({ develop: true }) });
      setIdeas((xs) => xs.map((x) => (x.id === id ? idea : x)));
    } catch (e) { say(e.message); }
    setWorking(null);
  }
  async function remove(id) {
    try { await api(`/api/ideas/${id}`, { method: "DELETE" }); setIdeas((xs) => xs.filter((x) => x.id !== id)); } catch (e) { say(e.message); }
  }

  const shown = I.filter((i) => !filter || i.kind === filter);
  const label = Object.fromEntries(KINDS);
  return (
    <section style={{ marginTop: 18 }}>
      <div className="panel">
        <h2 className="h2">Ideas</h2>
        <p className="sub">Apunta todo aquí: ideas de reels, sistemas que viste fuera, nichos, clientes. Con un clic el agente lo convierte en guion y caption, o en una ficha de sistema lista para vender.</p>
        <form className="ideaform" onSubmit={add}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de idea">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea placeholder="Ej.: sistema de reservas con señal para discotecas latinas" value={text} onChange={(e) => setText(e.target.value)} aria-label="Idea" />
          <button className="btn primary" disabled={!text.trim()}>Guardar</button>
        </form>
      </div>
      <div className="filters" style={{ marginTop: 16 }}>
        <button className="chip" aria-pressed={!filter} onClick={() => setFilter("")}>Todas · {I.length}</button>
        {KINDS.map(([v, l]) => <button key={v} className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {!ideas && <div className="empty"><span className="spin" />Cargando ideas…</div>}
      {ideas && !shown.length && <div className="empty">Sin ideas todavía. Escribe la primera arriba.</div>}
      <div className="ideas">
        {shown.map((i) => (
          <article key={i.id} className="idea">
            <div className="row">
              <span className="tag">{label[i.kind] || i.kind}</span>
              {i.source && i.source !== "Marcelo" && <span className="pill">De {i.source}</span>}
              <span className="phone">{new Date(i.created_at).toLocaleDateString("es-ES")}</span>
              <span className="grow" />
              <button className="ghost" onClick={() => remove(i.id)} aria-label="Borrar idea">Borrar</button>
            </div>
            <p>{i.text}</p>
            {i.output
              ? <>
                  <div className="output">{i.output}</div>
                  <div className="row">
                    <button className="btn" onClick={() => navigator.clipboard.writeText(i.output).then(() => say("Copiado"))}>Copiar</button>
                    <button className="btn" disabled={working === i.id} onClick={() => develop(i.id)}>{working === i.id ? "Rehaciendo…" : "Rehacer"}</button>
                  </div>
                </>
              : <div className="row">
                  <button className="btn primary" disabled={working === i.id} onClick={() => develop(i.id)}>
                    {working === i.id ? <><span className="spin" />Desarrollando…</> : i.kind === "sistema" ? "Convertir en ficha de sistema" : i.kind === "contenido" ? "Convertir en reel" : "Desarrollar"}
                  </button>
                </div>}
          </article>
        ))}
      </div>
    </section>
  );
}
