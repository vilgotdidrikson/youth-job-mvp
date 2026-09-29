"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getUserProfile, signIn, signUp } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { Role } from "@/lib/types";
import { getYouthFlowState } from "@/lib/youth-job-flow";

type Mode = "login" | "signup";

function LoginPageContent({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: sessionLoading } = useSession();
  const isRedirectingAfterSignup = useRef(false);
  const requestedRedirect = searchParams.get("redirect");
  const safeRedirectTarget = requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//") ? requestedRedirect : null;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("youth");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionLoading || !user || isRedirectingAfterSignup.current) return;
    let active = true;
    void (async () => {
      const { data: isAdmin, error: adminError } = await getSupabaseClient().rpc("is_admin_account");
      if (!active) return;
      if (!adminError && isAdmin === true) {
        router.replace(safeRedirectTarget ?? "/admin");
        return;
      }
      if (!profile) return;
      if (profile.role === "youth") {
        const state = await getYouthFlowState(user.id);
        if (active) router.replace(!state.shortOnboardingCompleted ? "/youth/onboarding" : safeRedirectTarget ?? "/swipe");
        return;
      }
      router.replace(safeRedirectTarget ?? (profile.role === "company" ? "/company?view=swipe" : "/private"));
    })();
    return () => { active = false; };
  }, [profile, router, safeRedirectTarget, sessionLoading, user]);

  useEffect(() => {
    if (searchParams.get("role") === "company") {
      setRole("company");
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Lösenorden matchar inte. Kontrollera och försök igen.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Lösenordet måste innehålla minst 8 tecken.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const result = await signUp(email, password, role);
        if (result.session) {
          isRedirectingAfterSignup.current = true;
          router.replace(role === "youth" ? "/youth/onboarding" : role === "company" ? "/company/onboarding" : "/private");
          return;
        }
        setMessage("Konto skapat. Kolla din e-post för att bekräfta, logga sedan in.");
        setMode("login");
        return;
      }
      const session = await signIn(email, password);
      const { data: isAdmin, error: adminError } = await getSupabaseClient().rpc("is_admin_account");
      if (!adminError && isAdmin === true) {
        router.replace(safeRedirectTarget ?? "/admin");
        return;
      }
      const signedInProfile = await getUserProfile(session.user.id);
      if (signedInProfile?.role === "youth") {
        const state = await getYouthFlowState(session.user.id);
        router.replace(!state.shortOnboardingCompleted ? "/youth/onboarding" : safeRedirectTarget ?? "/swipe");
      } else router.replace(safeRedirectTarget ?? (signedInProfile?.role === "company" ? "/company?view=swipe" : "/private"));
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : "Authentication failed.";
      if (mode === "signup" && msg.toLowerCase().includes("already registered")) {
        setError("Det finns redan ett konto med den e-postadressen. Logga in istället.");
        setMode("login");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <main
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  const isSignup = mode === "signup";
  return (
    <main className="auth-page">
      <section className={`auth-layout auth-layout-form-only ${!isSignup ? "auth-layout-login" : ""}`}>
        <div className="auth-form-stack">
          <button type="button" className="auth-back auth-back-above" onClick={() => router.push("/")} aria-label="Tillbaka till startsidan"><span aria-hidden="true">←</span><span>Tillbaka</span></button>
          <form className={`auth-card ${!isSignup ? "auth-card-login" : ""}`} onSubmit={handleSubmit}>
          <div className="auth-card-heading"><h2>{isSignup ? "Skapa konto" : "Logga in"}</h2><p>{isSignup ? "Fyll i dina uppgifter nedan." : "Ange dina uppgifter för att fortsätta."}</p></div>
          {isSignup && <fieldset className="auth-role"><legend>Jag är...</legend><div><button type="button" className={role === "youth" ? "auth-role-selected" : ""} onClick={() => setRole("youth")}>Arbetssökande</button><button type="button" className={role === "company" ? "auth-role-selected" : ""} onClick={() => setRole("company")}>Företag</button></div></fieldset>}
          <div className="auth-fields">
            <label>E-postadress<input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Lösenord<input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} required minLength={isSignup ? 8 : undefined} /></label>
            {!isSignup && <Link href="/forgot-password" className="auth-switch" style={{ display: "inline-block", textAlign: "left" }}>Glömt lösenord?</Link>}
            {isSignup && <label>Bekräfta lösenord<input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></label>}
          </div>
          {error && <p className="auth-message auth-error">{error}</p>}
          {message && <p className="auth-message auth-success">{message}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Vänta..." : isSignup ? "Skapa konto" : "Logga in"}<span aria-hidden="true">↗</span></button>
          <button type="button" className="auth-switch" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); setMessage(""); setConfirmPassword(""); }}>{isSignup ? "Har du redan ett konto? Logga in" : "Inget konto? Skapa ett"}</button>
          </form>
        </div>
      </section>
      <footer className="auth-footer">© 2026 Employo <span>En enklare väg från nyfiken till anställd.</span></footer>
    </main>
  );
}

export default function LoginPage({ initialMode = "login" }: { initialMode?: Mode }) {
  return <Suspense fallback={null}><LoginPageContent initialMode={initialMode} /></Suspense>;
}
