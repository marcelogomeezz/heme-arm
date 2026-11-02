"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = "/";
    else { setErr((await r.json()).error || "No se pudo entrar."); setBusy(false); }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="logo">
          <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 84 V50 a16 16 0 0 1 32 0 V84 M50 50 a16 16 0 0 1 32 0 V84" fill="none" stroke="#EDEBE6" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/><circle cx="88" cy="20" r="8" fill="#FF5A26"/></svg>
          <b>Heme <em>ARM</em></b>
        </div>
        <label className="lbl" htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
        <button className="btn primary" disabled={busy || !pw}>{busy ? "Entrando…" : "Entrar"}</button>
        {err && <p className="status err">{err}</p>}
      </form>
    </main>
  );
}
