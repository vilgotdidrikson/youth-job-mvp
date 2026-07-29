"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { signIn, signUp } from "@/lib/auth";
import type { Role } from "@/lib/types";

type Mode = "login" | "signup";

export default function LoginPage({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
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
    if (!sessionLoading && user && !isRedirectingAfterSignup.current) {
      router.replace("/dashboard");
    }
  }, [router, sessionLoading, user]);

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
          router.replace(role === "youth" ? "/youth/onboarding" : "/company/onboarding");
          return;
        }
        setMessage("Konto skapat. Kolla din e-post för att bekräfta, logga sedan in.");
        setMode("login");
        return;
      }
      await signIn(email, password);
      router.replace("/dashboard");
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
      <nav className="auth-nav">
        <button type="button" className="auth-back" onClick={() => router.push("/")} aria-label="Tillbaka till startsidan">←</button>
        <span className="landing-logo"><span className="landing-logo-mark">E</span><span>employo</span></span>
      </nav>
      <section className={`auth-layout auth-layout-form-only ${!isSignup ? "auth-layout-login" : ""}`}>
        <form className={`auth-card ${!isSignup ? "auth-card-login" : ""}`} onSubmit={handleSubmit}>
          <div className="auth-card-heading"><h2>{isSignup ? "Skapa konto" : "Logga in"}</h2><p>{isSignup ? "Fyll i dina uppgifter nedan." : "Ange dina uppgifter för att fortsätta."}</p></div>
          {isSignup && <fieldset className="auth-role"><legend>Jag är...</legend><div><button type="button" className={role === "youth" ? "auth-role-selected" : ""} onClick={() => setRole("youth")}>Arbetssökande</button><button type="button" className={role === "company" ? "auth-role-selected" : ""} onClick={() => setRole("company")}>Arbetsgivare</button></div></fieldset>}
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
      </section>
      <footer className="auth-footer">© 2026 Employo <span>En enklare väg från nyfiken till anställd.</span></footer>
    </main>
  );
}
