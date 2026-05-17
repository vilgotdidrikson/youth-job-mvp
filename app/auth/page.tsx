"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { signIn, signUp } from "@/lib/auth";
import type { Role } from "@/lib/types";

type Mode = "landing" | "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [mode, setMode] = useState<Mode>("landing");
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const result = await signUp(email, password, role);
        if (result.session) {
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

  /* Landing screen */
  if (mode === "landing") {
    return (
      <main
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          background: "#ffffff",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 2rem",
            paddingTop: "20vh",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              background: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ color: "#fff", fontSize: "1.9rem", fontWeight: 800, lineHeight: 1 }}>W</span>
          </div>

          <h1
            style={{
              fontSize: "2.2rem",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#111111",
              textAlign: "center",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            WorkSpot
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "1.05rem",
              color: "#737373",
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            Ungdomsjobb.<br />Swipa. Matcha. Jobba.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "0 1.5rem",
            paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px) + 1.5rem)",
          }}
        >
          <button
            type="button"
            className="cta-btn"
            style={{ padding: "1rem", fontSize: "1rem", width: "100%" }}
            onClick={() => setMode("signup")}
          >
            Skapa konto
          </button>
          <button
            type="button"
            className="secondary-btn"
            style={{ padding: "1rem", fontSize: "1rem", width: "100%" }}
            onClick={() => setMode("login")}
          >
            Logga in
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              color: "#a3a3a3",
              marginTop: "0.25rem",
            }}
          >
            För åldrar 12–20 och svenska företag
          </p>
        </div>
      </main>
    );
  }

  /* Auth form (login / signup) */
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        background: "#ffffff",
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "1rem 1.25rem 0",
          gap: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("landing");
            setError("");
            setMessage("");
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1.5px solid #e8e8e8",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Tillbaka"
        >
          ←
        </button>
        <h1
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#111111",
          }}
        >
          {mode === "signup" ? "Skapa konto" : "Välkommen tillbaka"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem 1.25rem" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
          <input
            className="input-field"
            placeholder="E-postadress"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="input-field"
            placeholder="Lösenord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />

          {mode === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#737373",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Jag är…
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setRole("youth")}
                  style={{
                    padding: "0.75rem",
                    borderRadius: 10,
                    border: role === "youth" ? "2px solid #111111" : "1.5px solid #e8e8e8",
                    background: role === "youth" ? "#111111" : "#fff",
                    color: role === "youth" ? "#fff" : "#111111",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Jag söker jobb
                </button>
                <button
                  type="button"
                  onClick={() => setRole("company")}
                  style={{
                    padding: "0.75rem",
                    borderRadius: 10,
                    border: role === "company" ? "2px solid #111111" : "1.5px solid #e8e8e8",
                    background: role === "company" ? "#111111" : "#fff",
                    color: role === "company" ? "#fff" : "#111111",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Vi söker personal
                </button>
              </div>
            </div>
          )}

          {error && (
            <p
              style={{
                borderRadius: 10,
                background: "#fff1f0",
                border: "1px solid #ffd6d3",
                padding: "0.65rem 0.85rem",
                fontSize: "0.85rem",
                color: "#c0392b",
              }}
            >
              {error}
            </p>
          )}
          {message && (
            <p
              style={{
                borderRadius: 10,
                background: "#f0faf5",
                border: "1px solid #b9e5d7",
                padding: "0.65rem 0.85rem",
                fontSize: "0.85rem",
                color: "#226a54",
              }}
            >
              {message}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="submit"
            className="cta-btn"
            style={{ padding: "1rem", fontSize: "1rem", width: "100%" }}
            disabled={loading}
          >
            {loading ? "Vänta..." : mode === "signup" ? "Skapa konto" : "Logga in"}
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 500,
              color: "#737373",
              cursor: "pointer",
              textAlign: "center",
              padding: "0.5rem",
            }}
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signup"
              ? "Har du redan ett konto? Logga in"
              : "Inget konto? Skapa ett"}
          </button>
        </div>
      </form>
    </main>
  );
}
