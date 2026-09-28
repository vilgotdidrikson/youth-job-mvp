"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { changePassword } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export default function AdminProfilePage() {
  const router = useRouter();
  const { user, status, error: sessionError, adminReady, isAdmin, logout } = useAdminAccess();
  const [name, setName] = useState(typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!adminReady || !user) return;
    const storedName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
    const timeoutId = window.setTimeout(() => setName(storedName), 0);
    return () => window.clearTimeout(timeoutId);
  }, [adminReady, user]);

  if (status !== "ready" || !adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError} />;
  if (!isAdmin) return <main className="mobile-shell"><h1>Ingen administratörsåtkomst</h1></main>;

  const saveName = async () => {
    setBusy(true); setError(""); setMessage("");
    const { error: updateError } = await getSupabaseClient().auth.updateUser({ data: { full_name: name.trim() } });
    if (updateError) setError("Kunde inte spara profilnamnet."); else setMessage("Adminprofilen har sparats.");
    setBusy(false);
  };

  const savePassword = async () => {
    setError(""); setMessage("");
    if (!currentPassword) { setError("Ange ditt nuvarande lösenord."); return; }
    if (newPassword.length < 8) { setError("Det nya lösenordet måste innehålla minst 8 tecken."); return; }
    if (newPassword !== confirmPassword) { setError("De nya lösenorden matchar inte."); return; }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage("Lösenordet har ändrats.");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Kunde inte ändra lösenordet.");
    } finally { setBusy(false); }
  };

  return <AdminShell title="Adminprofil" email={user?.email}>
    {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
    {message && <p className="admin-alert admin-alert-success" role="status">{message}</p>}
    <section className="admin-profile-summary"><span>{(name || user?.email || "A").slice(0, 1).toUpperCase()}</span><div><small>Inloggat adminkonto</small><h2>{name || "Administratör"}</h2><p>{user?.email}</p></div><b>Aktiv behörighet</b></section>
    <div className="admin-profile-grid">
      <section className="admin-panel"><h2>Profil</h2><p>Namnet används bara i den interna adminmiljön. Behörigheten styrs fortfarande av databasen.</p><label className="admin-field"><span>Visningsnamn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ditt namn" /></label><label className="admin-field"><span>E-postadress</span><input value={user?.email || ""} disabled /></label><button type="button" className="cta-btn" disabled={busy} onClick={() => void saveName()}>Spara profil</button></section>
      <section className="admin-panel"><h2>Byt lösenord</h2><p>Bekräfta alltid det nuvarande lösenordet.</p><label className="admin-field"><span>Nuvarande lösenord</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="admin-field"><span>Nytt lösenord</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label className="admin-field"><span>Bekräfta nytt lösenord</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button type="button" className="secondary-btn" disabled={busy} onClick={() => void savePassword()}>Ändra lösenord</button></section>
    </div>
    <button type="button" className="secondary-btn admin-logout" onClick={() => void logout().then(() => router.replace("/login"))}>Logga ut från admin</button>
  </AdminShell>;
}
