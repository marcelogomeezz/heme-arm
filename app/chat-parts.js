"use client";
// Heme ARM 3.0 — Chat con el consejo, Plan y Brief.
import { useEffect, useRef, useState } from "react";

export const SEATS = [
  { key: "claude", name: "Claude", color: "var(--claude)" },
  { key: "gpt", name: "ChatGPT", color: "var(--gpt)" },
  { key: "grok", name: "Grok", color: "var(--grok)" },
];
const TYPE_LABEL = { servicio: "Servicio", contenido: "Contenido", tarea: "Tarea", mensaje: "Mensaje", "campaña": "Campaña", campana: "Campaña" };
const SUGGESTIONS = [
  "¿Qué servicio salgo a vender esta semana para cobrar rápido?",
  "Investiga qué contenido sobre IA para negocios funciona en Instagram y dame 7 ideas para esta semana",
  "Analiza a la competencia de Heme en Instagram y dime cómo diferenciarme",
  "¿Cómo consigo mi primer cliente en Caracas en 7 días?",
];

export function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
export function md(text) {
  const lines = esc(text || "").split("\n"); let html = "", inList = false;
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
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
export async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  if (r.status === 401) { location.href = "/login"; throw new Error("Sesión caducada"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Algo falló. Prueba otra vez.");
  return j;
}
const Dots = () => <span className="dots3">{SEATS.map((s) => <i key={s.key} style={{ background: s.color }} />)}</span>;

// ================= CHAT =================
export function Chat({ providers, preset, say, onPlanAdded, onVote, onSettings }) {
  const [threads, setThreads] = useState([]);
  const [tid, setTid] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [doResearch, setDoResearch] = useState(true);
  const [doDebate, setDoDebate] = useState(true);
  const [live, setLive] = useState(null);
  const endRef = useRef(null);
  const busy = Boolean(live);
  const ready = SEATS.filter((s) => providers?.[s.key]?.ready).map((s) => s.key);

  useEffect(() => { api("/api/threads").then((j) => setThreads(j.threads)).catch(() => {}); }, []);
  useEffect(() => { if (preset?.text) { setText(preset.text); setTid(null); setMsgs([]); } }, [preset?.at]); // eslint-disable-line
  useEffect(() => { if (msgs.length || live) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, live?.stage]); // eslint-disable-line

  async function openThread(id) {
    if (busy) return; setTid(id);
    try { const j = await api(`/api/threads/${id}`); setMsgs(j.messages); } catch (e) { say(e.message); }
  }
  function newThread() { if (busy) return; setTid(null); setMsgs([]); setText(""); }
  async function removeThread(id) {
    try { await api(`/api/threads/${id}`, { method: "DELETE" }); setThreads((t) => t.filter((x) => x.id !== id)); if (tid === id) newThread(); } catch (e) { say(e.message); }
  }

  async function send(q0) {
    const question = (q0 ?? text).trim(); if (!question || busy) return;
    if (!ready.length) { say("No hay ningún modelo conectado."); return; }
    setText("");
    let threadId = tid;
    try {
      if (!threadId) {
        const { thread } = await api("/api/threads", { method: "POST", body: JSON.stringify({ title: question.slice(0, 80) }) });
        threadId = thread.id; setTid(thread.id); setThreads((t) => [thread, ...t]);
      }
      const { message } = await api(`/api/threads/${threadId}`, { method: "POST", body: JSON.stringify({ role: "user", content: question }) });
      setMsgs((m) => [...m, message]);
    } catch (e) { say(e.message); return; }

    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    const st = { stage: "research", research: {}, proposals: {}, critiques: {}, status: {} };
    const upd = (patch) => { Object.assign(st, patch); setLive({ ...st, research: { ...st.research }, proposals: { ...st.proposals }, critiques: { ...st.critiques }, status: { ...st.status } }); };
    const step = (body) => api("/api/chat", { method: "POST", body: JSON.stringify({ question, ...body }) });
    upd({});

    // 0 · investigación
    let findings = "";
    if (doResearch) {
      const who = ["claude", "grok"].filter((k) => ready.includes(k));
      who.forEach((k) => (st.status["r_" + k] = "run")); upd({ stage: "research" });
      await Promise.all(who.map(async (k) => {
        try { const j = await step({ step: "research", provider: k }); st.research[k] = j.text; st.status["r_" + k] = "ok"; }
        catch (e) { st.status["r_" + k] = "err"; st.research[k] = ""; }
        upd({});
      }));
      findings = Object.entries(st.research).filter(([, v]) => v).map(([k, v]) => `[${k === "grok" ? "Grok · X y web" : "Claude · web"}]\n${v}`).join("\n\n");
    }
    // 1 · propuestas
    ready.forEach((k) => (st.status["p_" + k] = "run")); upd({ stage: "propose" });
    await Promise.all(ready.map(async (k) => {
      try { const j = await step({ step: "propose", provider: k, history, findings }); st.proposals[k] = j.text; st.status["p_" + k] = "ok"; }
      catch (e) { st.status["p_" + k] = "err"; st.proposals[k] = ""; st.errors = { ...(st.errors || {}), [k]: e.message }; }
      upd({});
    }));
    const okProps = Object.fromEntries(Object.entries(st.proposals).filter(([, v]) => v));
    if (!Object.keys(okProps).length) { setLive(null); say(Object.values(st.errors || {})[0] || "Ningún modelo respondió."); return; }
    // 2 · debate
    if (doDebate && Object.keys(okProps).length > 1) {
      Object.keys(okProps).forEach((k) => (st.status["c_" + k] = "run")); upd({ stage: "critique" });
      await Promise.all(Object.keys(okProps).map(async (k) => {
        try { const j = await step({ step: "critique", provider: k, proposals: okProps }); st.critiques[k] = j.text; st.status["c_" + k] = "ok"; }
        catch { st.status["c_" + k] = "err"; }
        upd({});
      }));
    }
    // 3 · consenso
    upd({ stage: "consensus" });
    try {
      const c = await step({ step: "consensus", history, findings, proposals: okProps, critiques: st.critiques });
      const data = { agreement: c.agreement, best: c.best, proposals: c.proposals, accepted: [], deliberation: { research: st.research, proposals: st.proposals, critiques: st.critiques } };
      const { message } = await api(`/api/threads/${threadId}`, { method: "POST", body: JSON.stringify({ role: "council", content: c.answer, data }) });
      setMsgs((m) => [...m, message]);
    } catch (e) { say(e.message); }
    setLive(null);
  }

  async function accept(msgId, p, i) {
    try {
      await api("/api/plan", { method: "POST", body: JSON.stringify({ type: (p.type || "tarea").replace("campana", "campaña"), title: p.title, detail: p.detail, source: threads.find((t) => t.id === tid)?.title || "Consejo" }) });
      setMsgs((ms) => ms.map((m) => (m.id === msgId ? { ...m, data: { ...m.data, accepted: [...(m.data?.accepted || []), i] } } : m)));
      onPlanAdded?.(); say("Añadido a tu plan");
    } catch (e) { say(e.message); }
  }

  return (
    <div className="chat fade">
      <aside className="threads">
        <button className="btn primary" onClick={newThread} disabled={busy}>+ Nueva conversación</button>
        <div className="lbl" style={{ margin: "16px 4px 8px" }}>Conversaciones</div>
        <div className="thread-list">
          {!threads.length && <p className="sub" style={{ fontSize: 13, padding: "0 4px" }}>Aún no hay conversaciones.</p>}
          {threads.map((t) => (
            <div key={t.id} className={`thread-item${t.id === tid ? " on" : ""}`}>
              <button onClick={() => openThread(t.id)} title={t.title}>{t.title}</button>
              <button className="del" onClick={() => removeThread(t.id)} aria-label="Borrar conversación">×</button>
            </div>
          ))}
        </div>
        <button className="ghost ctx-btn" onClick={onSettings}>Lo que el consejo sabe de ti</button>
      </aside>

      <section className="convo">
        <div className="convo-scroll">
          {!msgs.length && !busy && (
            <div className="hello">
              <Dots />
              <h2 className="title" style={{ fontSize: "clamp(34px,4.4vw,56px)" }}>Habla con tu <em>consejo</em></h2>
              <p className="sub">Claude, ChatGPT y Grok investigan, proponen, debaten entre ellos y te dan una sola respuesta. Lo que aceptes pasa a tu plan.</p>
              <div className="sugs">{SUGGESTIONS.map((s) => <button key={s} className="sug" onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          )}
          {msgs.map((m) => m.role === "user"
            ? <div key={m.id} className="bubble-user fade">{m.content}</div>
            : <CouncilAnswer key={m.id} m={m} accept={accept} onVote={onVote} say={say} />)}
          {busy && <LiveProgress live={live} ready={ready} doResearch={doResearch} doDebate={doDebate} />}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Pregunta al consejo…" aria-label="Mensaje"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={busy} />
          <div className="composer-bar">
            <label className="toggle"><input type="checkbox" checked={doResearch} onChange={(e) => setDoResearch(e.target.checked)} /><span />Investigar<em className="long"> en internet</em></label>
            <label className="toggle"><input type="checkbox" checked={doDebate} onChange={(e) => setDoDebate(e.target.checked)} /><span />Debate<em className="long"> entre ellos</em></label>
            <span className="grow" />
            <span className="model-mini">{SEATS.map((s) => <i key={s.key} title={s.name} style={{ background: providers?.[s.key]?.ready ? s.color : "transparent", boxShadow: providers?.[s.key]?.ready ? "none" : "inset 0 0 0 1.5px var(--dim)" }} />)}</span>
            <button className="btn primary" disabled={busy || !text.trim()}>{busy ? <><span className="spin" /> Deliberando…</> : "Enviar"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LiveProgress({ live, ready, doResearch, doDebate }) {
  const stages = [
    doResearch && { k: "research", label: "Investigando", items: ["claude", "grok"].filter((x) => ready.includes(x)).map((x) => ({ key: x, sub: x === "grok" ? "X y web" : "web", st: live.status["r_" + x] })) },
    { k: "propose", label: "Proponiendo", items: ready.map((x) => ({ key: x, st: live.status["p_" + x] })) },
    doDebate && ready.length > 1 && { k: "critique", label: "Debatiendo", items: ready.map((x) => ({ key: x, st: live.status["c_" + x] })) },
    { k: "consensus", label: "Llegando a un acuerdo", items: [] },
  ].filter(Boolean);
  const order = stages.map((s) => s.k); const cur = order.indexOf(live.stage);
  return (
    <div className="live panel fade" aria-live="polite">
      <div className="row"><Dots /><b style={{ fontFamily: "var(--display)", fontStretch: "85%", fontSize: 18, textTransform: "uppercase" }}>El consejo está trabajando</b></div>
      <div className="stages">
        {stages.map((s, i) => (
          <div key={s.k} className={`stage${i < cur ? " done" : i === cur ? " now" : ""}`}>
            <div className="stage-h">{i < cur ? "✓" : i === cur ? <span className="spin" /> : "·"} {s.label}</div>
            {s.items.length > 0 && <div className="stage-items">{s.items.map((it) => { const seat = SEATS.find((x) => x.key === it.key); return (
              <span key={it.key} className={`who ${it.st || ""}`} style={{ "--c": seat.color }}><i />{seat.name}{it.sub ? ` · ${it.sub}` : ""}{it.st === "err" ? " · sin respuesta" : ""}</span>
            ); })}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CouncilAnswer({ m, accept, onVote, say }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("proposals");
  const [voted, setVoted] = useState(null);
  const d = m.data || {};
  const best = SEATS.find((s) => s.key === d.best);
  const delib = d.deliberation || {};
  const hasResearch = Object.values(delib.research || {}).some(Boolean);
  const hasCrit = Object.values(delib.critiques || {}).some(Boolean);
  return (
    <article className="answer panel fade">
      <div className="answer-h"><Dots /><b>El consejo</b>{best && <span className="pill" style={{ color: best.color, borderColor: best.color }}>Idea clave: {best.name}</span>}
        <span className="grow" /><button className="btn sm" onClick={() => navigator.clipboard.writeText(m.content).then(() => say("Copiado"))}>Copiar</button></div>
      <div className="answer-b" dangerouslySetInnerHTML={{ __html: md(m.content) }} />
      {d.agreement && <p className="agree">{d.agreement}</p>}
      {d.proposals?.length > 0 && (
        <div className="props">
          <span className="lbl">Propuestas para tu plan</span>
          {d.proposals.map((p, i) => { const ok = d.accepted?.includes(i); return (
            <div key={i} className={`prop${ok ? " ok" : ""}`}>
              <span className="tag">{TYPE_LABEL[p.type] || p.type || "Tarea"}</span>
              <div style={{ minWidth: 0 }}><b>{p.title}</b><small>{p.detail}</small></div>
              <button className={`btn sm${ok ? "" : " primary"}`} disabled={ok} onClick={() => accept(m.id, p, i)}>{ok ? "✓ En tu plan" : "Aceptar"}</button>
            </div>
          ); })}
        </div>
      )}
      <button className="delib-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Ocultar deliberación ↑" : "Ver cómo deliberaron ↓"}</button>
      {open && (
        <div className="delib fade">
          <div className="chips">
            {hasResearch && <button className="chip" aria-pressed={tab === "research"} onClick={() => setTab("research")}>Investigación</button>}
            <button className="chip" aria-pressed={tab === "proposals"} onClick={() => setTab("proposals")}>Propuestas</button>
            {hasCrit && <button className="chip" aria-pressed={tab === "critiques"} onClick={() => setTab("critiques")}>Debate</button>}
          </div>
          <div className="delib-cols">
            {SEATS.filter((s) => (delib[tab] || {})[s.key]).map((s) => (
              <div key={s.key} className={`seat${voted === s.key ? " win" : ""}`} style={{ "--seat": s.color }}>
                <div className="seat-h"><span className="dot" style={{ background: s.color }} /><b>{s.name}</b></div>
                <div className="seat-b" dangerouslySetInnerHTML={{ __html: md(delib[tab][s.key]) }} />
                {tab === "proposals" && <div className="seat-f"><button className="btn sm" disabled={Boolean(voted)} onClick={() => { setVoted(s.key); onVote?.(s.key, m.content); }}>{voted === s.key ? "★ Tu favorita" : "★ Mejor idea"}</button></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// ================= PLAN =================
const PLAN_COLS = [["pendiente", "Pendiente"], ["en marcha", "En marcha"], ["hecho", "Hecho"]];
export function Plan({ items, setItems, say }) {
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState(""); const [type, setType] = useState("tarea");
  const I = items || [];
  const types = [...new Set(I.map((x) => x.type).filter(Boolean))];
  async function add(e) { e.preventDefault(); if (!title.trim()) return; try { const { item } = await api("/api/plan", { method: "POST", body: JSON.stringify({ title, type, source: "Manual" }) }); setItems((x) => [item, ...(x || [])]); setTitle(""); } catch (e) { say(e.message); } }
  async function move(it, dir) { const idx = PLAN_COLS.findIndex(([k]) => k === it.status); const next = PLAN_COLS[Math.max(0, Math.min(2, idx + dir))][0]; if (next === it.status) return; try { const { item } = await api(`/api/plan/${it.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }); setItems((x) => x.map((y) => (y.id === it.id ? item : y))); if (next === "hecho") say("¡Hecho! 🔥"); } catch (e) { say(e.message); } }
  async function remove(it) { try { await api(`/api/plan/${it.id}`, { method: "DELETE" }); setItems((x) => x.filter((y) => y.id !== it.id)); } catch (e) { say(e.message); } }
  const shown = I.filter((x) => !filter || x.type === filter);
  return (
    <div className="fade">
      <div className="top"><div><h1 className="title">Tu <em>plan</em></h1><p className="sub">Lo que aceptas del consejo vive aquí. Muévelo hasta "Hecho".</p></div></div>
      <form className="panel row" onSubmit={add} style={{ marginBottom: 14 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 160 }} aria-label="Tipo">{["tarea", "contenido", "servicio", "mensaje", "campaña"].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        <input type="text" className="grow" style={{ minWidth: 200 }} placeholder="Añadir algo a mano…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" />
        <button className="btn primary" disabled={!title.trim()}>Añadir</button>
      </form>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className="chip" aria-pressed={!filter} onClick={() => setFilter("")}>Todo · {I.length}</button>
        {types.map((t) => <button key={t} className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>{TYPE_LABEL[t] || t}</button>)}
      </div>
      <div className="kanban" style={{ gridAutoColumns: "minmax(280px,1fr)" }}>
        {PLAN_COLS.map(([k, label], ci) => { const col = shown.filter((x) => (x.status || "pendiente") === k); return (
          <section key={k} className="col"><div className="col-h"><b>{label}</b><span>{col.length}</span></div>
            {col.map((it) => (
              <div key={it.id} className="pcard fade">
                <div className="row"><span className="tag">{TYPE_LABEL[it.type] || it.type}</span><span className="grow" /><button className="del" onClick={() => remove(it)} aria-label="Borrar">×</button></div>
                <b>{it.title}</b>{it.detail && <small>{it.detail}</small>}
                <div className="row" style={{ marginTop: 6 }}>
                  {ci > 0 && <button className="btn sm" onClick={() => move(it, -1)}>←</button>}
                  <span className="grow" />
                  {ci < 2 && <button className="btn sm primary" onClick={() => move(it, 1)}>{ci === 0 ? "Empezar →" : "Hecho ✓"}</button>}
                </div>
              </div>
            ))}
            {!col.length && <p className="sub" style={{ fontSize: 13, textAlign: "center", padding: "20px 0" }}>Vacío</p>}
          </section>
        ); })}
      </div>
    </div>
  );
}

// ================= BRIEF =================
export function Brief({ briefs, setBriefs, say }) {
  const [busy, setBusy] = useState(false); const [open, setOpen] = useState(null);
  const B = briefs || [];
  async function gen() { setBusy(true); try { const { brief } = await api("/api/briefs", { method: "POST" }); setBriefs((x) => [brief, ...(x || [])]); setOpen(brief.id); } catch (e) { say(e.message); } setBusy(false); }
  const latest = B[0]; const shownId = open ?? latest?.id;
  return (
    <div className="fade">
      <div className="top"><div><h1 className="title">El <em>brief</em></h1><p className="sub">Tu newsletter privada: qué pasa hoy en IA y en redes, ideas de contenido y foco de ventas. Llega sola cada mañana a las 7:00.</p></div>
        <button className="btn primary" onClick={gen} disabled={busy}>{busy ? <><span className="spin" /> Investigando y escribiendo… (1–2 min)</> : "Generar brief ahora"}</button></div>
      {!briefs && <div className="empty"><span className="spin" /> Cargando…</div>}
      {briefs && !B.length && <div className="empty">Aún no hay briefs. Genera el primero.</div>}
      <div className="brief-grid">
        <div>{B.filter((b) => b.id === shownId).map((b) => (
          <article key={b.id} className="panel brief fade">
            <div className="row"><span className="lbl">{new Date(b.created_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span><span className="grow" /><button className="btn sm" onClick={() => navigator.clipboard.writeText(b.content).then(() => say("Copiado"))}>Copiar</button></div>
            <div className="answer-b" dangerouslySetInnerHTML={{ __html: md(b.content) }} />
          </article>
        ))}</div>
        {B.length > 1 && <aside className="panel"><span className="lbl">Archivo</span><div className="history" style={{ marginTop: 8 }}>
          {B.map((b) => <button key={b.id} onClick={() => setOpen(b.id)} style={{ gridTemplateColumns: "1fr auto" }}><small style={{ color: b.id === shownId ? "var(--fg)" : undefined }}>{new Date(b.created_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</small><span className="phone">{new Date(b.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span></button>)}
        </div></aside>}
      </div>
    </div>
  );
}

// ================= AJUSTES =================
export function Settings({ close, say }) {
  const [ctx, setCtx] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { api("/api/settings").then((j) => setCtx(j.context)).catch((e) => say(e.message)); }, []); // eslint-disable-line
  async function save() { setSaving(true); try { await api("/api/settings", { method: "PUT", body: JSON.stringify({ context: ctx }) }); say("Contexto guardado"); close(); } catch (e) { say(e.message); } setSaving(false); }
  return (<>
    <div className="scrim" onClick={close} />
    <div className="modal fade" role="dialog" aria-label="Contexto de Heme">
      <div className="row"><h2 className="title" style={{ fontSize: 34 }}>Lo que el consejo <em>sabe de ti</em></h2><span className="grow" /><button className="x" onClick={close} aria-label="Cerrar">×</button></div>
      <p className="sub">Este texto lo leen los tres modelos antes de cada respuesta. Actualízalo cuando cambie tu oferta, tus precios o tus objetivos.</p>
      {ctx === null ? <div className="empty"><span className="spin" /></div> : <textarea style={{ minHeight: 320, marginTop: 12 }} value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label="Contexto" />}
      <div className="row" style={{ marginTop: 12 }}><span className="grow" /><button className="btn" onClick={close}>Cancelar</button><button className="btn primary" onClick={save} disabled={saving || !ctx}>{saving ? "Guardando…" : "Guardar"}</button></div>
    </div>
  </>);
}
