"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "@/components/recruitment.module.css";

type Fixture = { accounts: { role: "company" | "youth"; email: string; password: string }[]; chat: string };

export function InvoicePilot({ userId }: { userId: string }) {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(method: "POST" | "DELETE") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (data.session?.user.id !== userId) throw Error("Logga in på nytt som admin.");
      const response = await fetch("/api/admin/invoice-pilot", {
        method, cache: "no-store",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "X-Account-Id": userId },
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Begäran kunde inte slutföras.");
      setFixture(method === "POST" ? result : null);
      if (method === "DELETE") setNotice("Dina fiktiva testkonton är rensade.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Begäran kunde inte slutföras.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.adminCard} aria-labelledby="invoice-pilot-heading">
    <h2 id="invoice-pilot-heading">Testa fakturaflödet</h2>
    <p>Fakturor i dev skapas för testföretaget nedan när testkandidaten bekräftar. Använd ett separat privat fönster för testkontona så att adminsessionen finns kvar.</p>
    <div className={styles.actions}>
      <button className="secondary-btn" type="button" disabled={busy || Boolean(fixture)} onClick={() => void run("POST")}>Skapa testkonton</button>
      <button className="secondary-btn" type="button" disabled={busy} onClick={() => void run("DELETE")}>Rensa mina testkonton</button>
    </div>
    {busy && <p role="status">Arbetar…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {fixture && <>
      <p>Uppgifterna visas tills du lämnar sidan. Rensa kontona när du har testat klart.</p>
      {fixture.accounts.map(account => <div key={account.role}>
        <h3>{account.role === "company" ? "Fiktivt företag" : "Fiktiv kandidat"}</h3>
        <label>E-post<input readOnly value={account.email} onFocus={event => event.currentTarget.select()}/></label>
        <label>Tillfälligt lösenord<input readOnly value={account.password} onFocus={event => event.currentTarget.select()}/></label>
      </div>)}
      <p>Logga in som testföretaget, godkänn testvillkoren och registrera anställningen i chatten. Logga sedan in som testkandidaten och välj Jobbet och nästa steg → Granska uppgifterna → Uppgifterna stämmer. Uppdatera fakturalistan här innan du rensar testkontona.</p>
      <Link href={`/login?redirect=${encodeURIComponent(fixture.chat)}`}>Inloggning för testmatchningen</Link>
    </>}
  </section>;
}
