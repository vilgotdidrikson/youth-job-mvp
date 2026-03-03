"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/client-api";
import { roleHome, saveSession } from "@/lib/client-session";
import { Role, SessionUser } from "@/lib/types";

type Mode = "login" | "signup";

interface AuthResponse {
  user: SessionUser;
  needsOnboarding: boolean;
}

function isValidPhone(value: string): boolean {
  return /^\+?\d[\d\s-]{6,}$/.test(value.trim());
}

export default function AuthPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("youth");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const t =
    language === "sv"
      ? {
          failed: "Inloggningen misslyckades.",
          title: "WorkSpot Inloggning",
          signupHeading: "Skapa ditt konto",
          loginHeading: "Välkommen tillbaka",
          signupSub: "Välj roll och kom igång på under en minut.",
          loginSub: "Logga in för att fortsätta matcha.",
          password: "Lösenord",
          phone: "Telefonnummer",
          youth: "Ungdom",
          company: "Företag",
          wait: "Vänta...",
          createAccount: "Skapa konto",
          signIn: "Logga in",
          googleSoon: "Fortsätt med Google (snart)",
          alreadyHave: "Har du redan ett konto? Logga in",
          needAccount: "Behöver du ett konto? Skapa ett",
          phoneInvalid: "Ange ett giltigt telefonnummer.",
        }
      : {
          failed: "Authentication failed.",
          title: "WorkSpot Access",
          signupHeading: "Create your account",
          loginHeading: "Welcome back",
          signupSub: "Choose role and get started in under a minute.",
          loginSub: "Sign in to continue matching.",
          password: "Password",
          phone: "Phone number",
          youth: "Youth",
          company: "Company",
          wait: "Please wait...",
          createAccount: "Create account",
          signIn: "Sign in",
          googleSoon: "Continue with Google (soon)",
          alreadyHave: "Already have an account? Sign in",
          needAccount: "Need an account? Create one",
          phoneInvalid: "Please enter a valid phone number.",
        };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!isValidPhone(phone)) {
      setError(t.phoneInvalid);
      return;
    }
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup" ? { email, phone, password, role } : { email, phone, password };

      const response = await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      saveSession(response.user);

      if (response.user.role === "youth" && phone.trim()) {
        await apiRequest("/api/youth/profile", {
          method: "PUT",
          userId: response.user.id,
          body: JSON.stringify({
            contactEmail: email.trim().toLowerCase(),
            contactPhone: phone.trim(),
          }),
        });
      }

      if (response.user.role === "youth" && response.needsOnboarding) {
        router.push("/youth/onboarding");
        return;
      }

      router.push(roleHome(response.user.role));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.failed);
    } finally {
      setLoading(false);
    }
  };

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
            placeholder={t.phone}
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            pattern="^\+?\d[\d\s-]{6,}$"
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

          <button type="submit" className="cta-btn w-full px-4 py-3 text-sm" disabled={loading}>
            {loading ? t.wait : mode === "signup" ? t.createAccount : t.signIn}
          </button>
          <button type="button" className="secondary-btn w-full px-4 py-3 text-sm opacity-70" disabled>
            {t.googleSoon}
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

