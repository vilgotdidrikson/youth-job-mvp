"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getSupabaseClient } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const { user, status, error: sessionError, adminReady, isAdmin } = useAdminAccess();
  const [pendingCompanies, setPendingCompanies] = useState<number | null>(null);

  useEffect(() => {
    if (!adminReady || !isAdmin) return;
    let active = true;
    void getSupabaseClient().rpc("get_pending_company_verifications").then(({ data }) => {
      if (active) setPendingCompanies(Array.isArray(data) ? data.filter((item) => item.verification_status === "pending").length : 0);
    });
    return () => { active = false; };
  }, [adminReady, isAdmin]);

  if (status !== "ready" || !adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError} />;
  if (!isAdmin) return <main className="mobile-shell"><section className="card" style={{ padding: "1.25rem" }}><h1>Ingen administratörsåtkomst</h1><p>Kontot finns inte i Employos adminlista.</p></section></main>;

  return <AdminShell title="Översikt" email={user?.email}>
    <section className="admin-welcome"><div><p>Internt arbetsverktyg</p><h2>Välkommen till Employo Admin</h2><span>Hantera verifieringar och administratörskontot från en separat, skyddad miljö.</span></div></section>
    <div className="admin-stat-grid">
      <article className="admin-stat-card"><span>Väntande företag</span><strong>{pendingCompanies ?? "–"}</strong><Link href="/admin/companies">Öppna verifieringskön →</Link></article>
      <article className="admin-stat-card"><span>Din behörighet</span><strong style={{ fontSize: "1.25rem" }}>Admin</strong><Link href="/admin/profile">Hantera profil →</Link></article>
    </div>
    <section className="admin-panel"><div><h2>Snabbåtgärder</h2><p>Det viktigaste för den nuvarande lanseringsfasen.</p></div><div className="admin-action-list"><Link href="/admin/companies"><strong>Granska företag</strong><span>Godkänn eller begär komplettering av organisationsuppgifter.</span></Link><Link href="/admin/profile"><strong>Kontosäkerhet</strong><span>Uppdatera visningsnamn eller byt administratörslösenord.</span></Link></div></section>
  </AdminShell>;
}
