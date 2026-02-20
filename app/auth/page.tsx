"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { roleHome, saveSession } from "@/lib/client-session";
import { Role, SessionUser } from "@/lib/types";

type Mode = "login" | "signup";

interface AuthResponse {
  user: SessionUser;
  needsOnboarding: boolean;
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("youth");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? { email, password, role }
          : { email, password };

      const response = await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      saveSession(response.user);

      if (response.user.role === "youth" && response.needsOnboarding) {
        router.push("/youth/onboarding");
        return;
      }

      router.push(roleHome(response.user.role));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Authentication failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell flex flex-col justify-center">
      <div className="glass-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6887]">
          WorkSpot Access
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#132742]">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-[#3f5f82]">
          {mode === "signup"
            ? "Choose role and get started in under a minute."
            : "Sign in to continue matching."}
        </p>

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
            placeholder="Password"
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
                Youth
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
                Company
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="cta-btn w-full px-4 py-3 text-sm"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
          <button
            type="button"
            className="secondary-btn w-full px-4 py-3 text-sm opacity-70"
            disabled
          >
            Continue with Google (soon)
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-[#2b5f98]"
          onClick={() => setMode((current) => (current === "signup" ? "login" : "signup"))}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </div>
    </div>
  );
}
