"use client";
import { useState } from "react";
import Link from "next/link";
export default function Unsubscribe() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function unsubscribe() {
    setBusy(true);
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      const res = await fetch("/api/prelaunch/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true); setMessage("Du är avregistrerad och får inga fler lanseringsutskick från väntelistan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Försök igen senare."); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 600, margin: "12vh auto", padding: 24 }}><h1 style={{ fontSize: 36, fontWeight: 700 }}>Avregistrera intresseanmälan</h1><p style={{ margin: "20px 0" }}>Vill du sluta få mejl om MatchnWorks lansering?</p>{!done && <button disabled={busy} onClick={unsubscribe} style={{ background: "#39232e", color: "white", borderRadius: 12, padding: "14px 22px" }}>{busy ? "Avregistrerar…" : "Ja, avregistrera mig"}</button>}<p role="status" style={{ margin: "20px 0" }}>{message}</p><Link href="/">Till startsidan →</Link></main>;
}
