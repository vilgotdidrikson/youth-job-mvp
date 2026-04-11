"use client";

import { FormEvent, useEffect, useState } from "react";
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
          title: "WorkSpot Inloggning",
          signupHeading: "Skapa ditt konto",
          loginHeading: "Välkommen tillbaka",
          signupSub: "Registrera dig med Supabase och skapa rätt profil direkt.",
          loginSub: "Logga in med ditt Supabase-konto.",
          password: "Lösenord",
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
        }
      : {
          failed: "Authentication failed.",
          title: "WorkSpot Access",
          signupHeading: "Create your account",
          loginHeading: "Welcome back",
          signupSub: "Register with Supabase and create the correct profile immediately.",
          loginSub: "Sign in with your Supabase account.",
          password: "Password",
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
      <div className="mobile-shell flex flex-col justify-center">
        <div className="mb-3 flex justify-end">
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loadingSession}</div>
      </div>
    );
  }

  return (
    <div className="mobile-shell flex flex-col justify-center">
      <div className="mb-3 flex justify-end">
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>
      <div className="glass-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">
          {t.title}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#132742]">
          {mode === "signup" ? t.signupHeading : t.loginHeading}
        </h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{mode === "signup" ? t.signupSub : t.loginSub}</p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-[#cce0ff] bg-white px-4 py-3 text-sm outline-none focus:border-[#1474ff]"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-2xl border border-[#cce0ff] bg-white px-4 py-3 text-sm outline-none focus:border-[#1474ff]"
            placeholder={t.password}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-sm font-medium ${
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
                className={`rounded-2xl border px-3 py-2 text-sm font-medium ${
                  role === "company"
                    ? "border-[#1474ff] bg-[#e7f1ff] text-[#11437a]"
                    : "border-[#cce0ff] bg-white text-[#47688e]"
                }`}
                onClick={() => setRole("company")}
              >
                {t.company}
              </button>
            </div>
          )}

          {error && <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">{error}</p>}
          {message && <p className="rounded-xl bg-[#e8f5ec] px-3 py-2 text-sm text-[#1f6845]">{message}</p>}

          <button type="submit" className="cta-btn w-full px-4 py-3 text-sm" disabled={loading}>
            {loading ? t.wait : mode === "signup" ? t.createAccount : t.signIn}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-[#2b5f98]"
          onClick={() => setMode((current) => (current === "signup" ? "login" : "signup"))}
        >
          {mode === "signup" ? t.alreadyHave : t.needAccount}
        </button>
      </div>
    </div>
  );
}
