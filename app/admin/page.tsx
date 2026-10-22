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
  const [openReports, setOpenReports] = useState<number | null>(null);

  useEffect(() => {
    if (!adminReady || !isAdmin) return;
    let active = true;
    void Promise.all([
      getSupabaseClient().rpc("get_pending_company_verifications"),
      getSupabaseClient().rpc("get_moderation_reports"),
    ]).then(([companiesResult, reportsResult]) => {
      if (!active) return;
      setPendingCompanies(Array.isArray(companiesResult.data) ? companiesResult.data.filter((item) => item.verification_status === "pending").length : 0);
      setOpenReports(Array.isArray(reportsResult.data) ? reportsResult.data.filter((item) => item.status === "open" || item.status === "reviewing").length : 0);
    });
    return () => { active = false; };
  }, [adminReady, isAdmin]);

  if (status !== "ready" || !adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError} />;
  if (!isAdmin) return <main className="mobile-shell"><section className="card" style={{ padding: "1.25rem" }}><h1>Ingen administratörsåtkomst</h1><p>Kontot finns inte i MatchnWorks adminlista.</p></section></main>;

  return <AdminShell title="Översikt" email={user?.email}>
    <section className="admin-welcome"><div><span className="admin-welcome-kicker">MatchnWork internt</span><h2>God eftermiddag.</h2><p>Här ser du vad som behöver hanteras innan företag och annonser kan publiceras.</p></div><div className="admin-welcome-mark" aria-hidden="true">E</div></section>
    <div className="admin-stat-grid">
      <Link className="admin-stat-card admin-stat-primary" href="/admin/companies"><div><span>Väntar på granskning</span><strong>{pendingCompanies ?? "–"}</strong></div><span className="admin-card-arrow" aria-hidden="true">→</span><small>Företag att kontrollera</small></Link>
      <Link className="admin-stat-card" href="/admin/reports"><div><span>Aktiva anmälningar</span><strong>{openReports ?? "–"}</strong></div><span className="admin-card-arrow" aria-hidden="true">→</span><small>Innehåll att granska</small></Link>
      <Link className="admin-stat-card" href="/admin/profile"><div><span>Ditt konto</span><strong className="admin-stat-label">Administratör</strong></div><span className="admin-card-arrow" aria-hidden="true">→</span><small>Profil och säkerhet</small></Link>
    </div>
    <section className="admin-panel"><div className="admin-section-heading"><div><span>Arbetskö</span><h2>Det här kan du göra nu</h2></div></div><div className="admin-action-list"><Link href="/admin/companies"><span className="admin-action-icon">✓</span><div><strong>Verifiera företag</strong><p>Kontrollera organisationsnummer och godkänn publicering.</p></div><b>Öppna →</b></Link><Link href="/admin/reports"><span className="admin-action-icon">!</span><div><strong>Granska anmälningar</strong><p>Bedöm rapporterat innehåll och dokumentera beslut.</p></div><b>Öppna →</b></Link><Link href="/admin/recruitment"><span className="admin-action-icon">✓</span><div><strong>Följ upp rekryteringar</strong><p>Granska anställningar, uteblivna registreringar och rekryteringsbehörighet.</p></div><b>Öppna →</b></Link><Link href="/admin/profile"><span className="admin-action-icon">●</span><div><strong>Hantera adminprofil</strong><p>Uppdatera namn, lösenord och kontoinställningar.</p></div><b>Öppna →</b></Link></div></section>
  </AdminShell>;
}
