"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
type Row = { id: string; role: string; name: string; email: string; company_name: string; created_at: string };
export default function LaunchAdmin() {
  const [role, setRole] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
      if (error) throw new Error("Kunde inte logga in. Kontrollera e-post och lösenord.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Inloggningen misslyckades."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    await getSupabaseClient().auth.signOut(); setRows([]); setTotal(null); setMessage("Du är utloggad.");
  }
  async function load(csv = false) {
    setBusy(true); setMessage(""); setRows([]); setTotal(null);
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Logga in med ditt administratörskonto i formuläret nedan.");
      const res = await fetch(`/api/prelaunch/admin?role=${role}${csv ? "&format=csv" : ""}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error);
      if (csv) {
        const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a"); a.href = url; a.download = `matchnwork-${role || "alla"}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("Exporten är hämtad. Använd kontakterna endast för lansering och pilot enligt deras samtycke.");
      } else { const data = await res.json(); setRows(data.rows); setTotal(data.total); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kunde inte hämta anmälningarna."); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 1100, margin: "6vh auto", padding: 24 }}><Link href="/">← Startsidan</Link><h1 style={{ fontSize: 36, fontWeight: 700, marginTop: 24 }}>Intresseanmälningar</h1><p style={{ margin: "16px 0" }}>Endast för administratörer. Aktiva anmälningar visas; avregistrerade kontakter ingår inte i exporten.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "24px 0" }}><label>Målgrupp <select value={role} onChange={e => { setRole(e.target.value); setRows([]); setTotal(null); }} style={{ padding: 12, border: "1px solid #bbaab2", borderRadius: 8 }}><option value="">Alla</option><option value="youth">Ungdomar</option><option value="company">Företag</option></select></label><button disabled={busy} onClick={() => load()} style={{ padding: 12, background: "#f6d9e4", borderRadius: 8 }}>Visa anmälningar</button><button disabled={busy} onClick={() => load(true)} style={{ padding: 12, background: "#39232e", color: "white", borderRadius: 8 }}>Hämta CSV</button></div><p role="status">{busy ? "Hämtar…" : message}</p>{total !== null && <p>{total} aktiva anmälningar. Visar de första {rows.length}.</p>}<div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left", marginTop: 20 }}><thead><tr>{["Målgrupp", "Namn", "E-post", "Företag", "Datum"].map(x => <th key={x} style={{ padding: 12 }}>{x}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{[row.role === "youth" ? "Ungdom" : "Företag", row.name, row.email, row.company_name, new Date(row.created_at).toLocaleDateString("sv-SE")].map((x, i) => <td key={i} style={{ padding: 12, borderTop: "1px solid #e9dce2" }}>{x}</td>)}</tr>)}</tbody></table></div><p style={{ marginTop: 24 }}>Utskick startas separat när ni är redo. CSV-filen innehåller en personlig avregistreringslänk som ska följa med varje mejl.</p><form onSubmit={signIn} style={{ marginTop: 30, paddingTop: 24, borderTop: "1px solid #e9dce2", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}><label style={{ display: "grid", gap: 6 }}>E-post<input name="email" type="email" autoComplete="username" required style={{ padding: 12, border: "1px solid #bbaab2", borderRadius: 8 }} /></label><label style={{ display: "grid", gap: 6 }}>Lösenord<input name="password" type="password" autoComplete="current-password" required style={{ padding: 12, border: "1px solid #bbaab2", borderRadius: 8 }} /></label><button disabled={busy} style={{ padding: 12, borderRadius: 8, background: "#39232e", color: "white" }}>Logga in som administratör</button><button type="button" onClick={signOut} disabled={busy} style={{ padding: 12 }}>Logga ut</button></form></main>;
}
