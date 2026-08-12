"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getUserProfile, signIn, signUp } from "@/lib/auth";
import type { Role } from "@/lib/types";

type Mode = "login" | "signup";

function LoginPageContent({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: sessionLoading } = useSession();
  const isRedirectingAfterSignup = useRef(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("youth");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionLoading && user && profile && !isRedirectingAfterSignup.current) {
      router.replace(profile.role === "company" ? "/company?view=swipe" : profile.role === "private" ? "/private" : "/swipe");
    }
  }, [profile, router, sessionLoading, user]);

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
      const signedInProfile = await getUserProfile(session.user.id);
      router.replace(signedInProfile?.role === "company" ? "/company?view=swipe" : signedInProfile?.role === "private" ? "/private" : "/swipe");
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
          {isSignup && <fieldset className="auth-role"><legend>Jag är...</legend><div><button type="button" className={role === "youth" ? "auth-role-selected" : ""} onClick={() => setRole("youth")}>Arbetssökande</button><button type="button" className={role === "company" ? "auth-role-selected" : ""} onClick={() => setRole("company")}>Företag</button><button type="button" className={role === "private" ? "auth-role-selected" : ""} onClick={() => setRole("private")}>Privatperson</button></div></fieldset>}
          <div className="auth-fields">
            <label>E-postadress<input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Lösenord<input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} required /></label>
            {isSignup && <label>Bekräfta lösenord<input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required /></label>}
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
