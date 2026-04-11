"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { signIn, signUp } from "@/lib/auth";
import type { Role } from "@/lib/types";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { user, loading: sessionLoading } = useSession();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("youth");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace("/dashboard");
    }
  }, [router, sessionLoading, user]);

  const t =
    language === "sv"
      ? {
          failed: "Autentiseringen misslyckades.",
          title: "WorkSpot Access",
          home: "Startsida",
          signupHeading: "Skapa ditt konto",
          loginHeading: "Välkommen tillbaka",
          signupSub: "Skapa konto på mobilen och välj rätt profiltyp direkt.",
          loginSub: "Logga in och fortsätt där du slutade.",
          email: "E-post",
          password: "Lösenord",
          chooseRole: "Välj kontotyp",
          youth: "Ungdom",
          company: "Företag",
          wait: "Vänta...",
          createAccount: "Skapa konto",
          signIn: "Logga in",
          alreadyHave: "Har du redan ett konto? Logga in",
          needAccount: "Behöver du ett konto? Skapa ett",
          emailConfirm:
            "Kontot skapades. Om e-postbekräftelse är aktiverad i Supabase, bekräfta din e-post och logga sedan in.",
          loadingSession: "Kontrollerar befintlig session...",
          powered: "Supabase Auth är aktiverat",
        }
      : {
          failed: "Authentication failed.",
          title: "WorkSpot Access",
          home: "Home",
          signupHeading: "Create your account",
          loginHeading: "Welcome back",
          signupSub: "Create your account on mobile and pick your profile type instantly.",
          loginSub: "Sign in and continue where you left off.",
          email: "Email",
          password: "Password",
          chooseRole: "Choose account type",
          youth: "Youth",
          company: "Company",
          wait: "Please wait...",
          createAccount: "Create account",
          signIn: "Sign in",
          alreadyHave: "Already have an account? Sign in",
          needAccount: "Need an account? Create one",
          emailConfirm:
            "Account created. If email confirmation is enabled in Supabase, confirm your email and then sign in.",
          loadingSession: "Checking existing session...",
          powered: "Supabase Auth is enabled",
        };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const result = await signUp(email, password, role);

        if (result.session) {
          router.replace("/dashboard");
          return;
        }

        setMessage(t.emailConfirm);
        setMode("login");
        return;
      }

      await signIn(email, password);
      router.replace("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.failed);
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loadingSession}</div>
      </main>
    );
  }

  return (
    <main className="mobile-shell flex flex-col justify-center pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <div className="glass-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">
          {t.title}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-[#132742]">
          {mode === "signup" ? t.signupHeading : t.loginHeading}
        </h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{mode === "signup" ? t.signupSub : t.loginSub}</p>
        <p className="mt-3 inline-flex rounded-full bg-[#e8f1ff] px-3 py-1 text-xs font-medium text-[#285182]">
          {t.powered}
        </p>

        <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
          <input
            className="h-12 w-full rounded-2xl border border-[#cce0ff] bg-white px-4 text-sm outline-none focus:border-[#1474ff]"
            placeholder={t.email}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="h-12 w-full rounded-2xl border border-[#cce0ff] bg-white px-4 text-sm outline-none focus:border-[#1474ff]"
            placeholder={t.password}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />

          {mode === "signup" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.chooseRole}</p>
              <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-medium ${
                  role === "youth"
                    ? "border-[#1474ff] bg-[#e7f1ff] text-[#11437a]"
                    : "border-[#cce0ff] bg-white text-[#47688e]"
                }`}
                onClick={() => setRole("youth")}
              >
                {t.youth}
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-medium ${
                  role === "company"
                    ? "border-[#1474ff] bg-[#e7f1ff] text-[#11437a]"
                    : "border-[#cce0ff] bg-white text-[#47688e]"
                }`}
                onClick={() => setRole("company")}
              >
                {t.company}
              </button>
            </div>
            </div>
          )}

          {error && <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">{error}</p>}
          {message && <p className="rounded-xl bg-[#e8f5ec] px-3 py-2 text-sm text-[#1f6845]">{message}</p>}

          <button type="submit" className="cta-btn min-h-12 w-full px-4 py-3 text-sm" disabled={loading}>
            {loading ? t.wait : mode === "signup" ? t.createAccount : t.signIn}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 min-h-10 text-sm font-medium text-[#2b5f98]"
          onClick={() => setMode((current) => (current === "signup" ? "login" : "signup"))}
        >
          {mode === "signup" ? t.alreadyHave : t.needAccount}
        </button>
      </div>
    </main>
  );
}
