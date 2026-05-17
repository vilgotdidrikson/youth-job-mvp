"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, error, logout, refresh } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/auth");
  };

  const quickActions =
    profile?.role === "company"
      ? [
          { label: "Lägg upp en roll", onClick: () => router.push("/company") },
          { label: "Granska ansökningar", onClick: () => router.push("/company") },
          { label: "Redigera profil", onClick: () => router.push("/company") },
        ]
      : [
          { label: "Hitta jobb", onClick: () => router.push("/swipe") },
          { label: "Redigera profil", onClick: () => router.push("/profile") },
          { label: "Mina chattar", onClick: () => router.push("/chats") },
        ];

  if (loading) {
    return (
      <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#737373", fontSize: "0.9rem" }}>Laddar...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mobile-shell">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", paddingTop: "0.5rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>
          WorkSpot
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: "0.2rem 0 0", lineHeight: 1.15 }}>
          {profile?.role === "company" ? "Företagskonto" : "Ditt konto"}
        </h1>
        <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>
          {user.email}
        </p>
      </div>

      {(error || !profile) && (
        <div
          style={{
            borderRadius: 12,
            background: "#fff1f0",
            border: "1px solid #ffd6d3",
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            color: "#c0392b",
            marginBottom: "1rem",
          }}
        >
          {error || "Profil hittades inte. Försök uppdatera."}
        </div>
      )}

      {/* Quick actions */}
      <section style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.6rem" }}>
          Snabbval
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="secondary-btn"
              style={{ padding: "0.875rem 1rem", fontSize: "0.9rem", textAlign: "left", width: "100%" }}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* Account info */}
      <section
        className="card"
        style={{ padding: "1rem", marginBottom: "1rem" }}
      >
        <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a3a3a3", marginBottom: "0.75rem" }}>
          Kontodetaljer
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "#737373" }}>E-post</span>
            <span style={{ color: "#111111", fontWeight: 500 }}>{user.email}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "#737373" }}>Kontotyp</span>
            <span style={{ color: "#111111", fontWeight: 500, textTransform: "capitalize" }}>{profile?.role ?? "—"}</span>
          </div>
        </div>
      </section>

      {/* Role message */}
      {profile?.role === "youth" && (
        <div
          style={{
            borderRadius: 12,
            background: "#f0faf5",
            border: "1px solid #b9e5d7",
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            color: "#226a54",
            marginBottom: "1rem",
          }}
        >
          Ungdomskonto aktivt — swipa och följ dina jobbmatchningar.
        </div>
      )}
      {profile?.role === "company" && (
        <div
          style={{
            borderRadius: 12,
            background: "#f5f5f5",
            border: "1px solid #e8e8e8",
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            color: "#4a4a4a",
            marginBottom: "1rem",
          }}
        >
          Företagskonto aktivt — hantera roller och granska kandidater.
        </div>
      )}

      {/* Sign out */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <button
          type="button"
          className="secondary-btn"
          style={{ padding: "0.875rem", fontSize: "0.9rem" }}
          onClick={() => void refresh()}
        >
          Uppdatera
        </button>
        <button
          type="button"
          className="cta-btn"
          style={{ padding: "0.875rem", fontSize: "0.9rem" }}
          onClick={() => void handleLogout()}
          disabled={loggingOut}
        >
          {loggingOut ? "Loggar ut..." : "Logga ut"}
        </button>
      </div>
    </main>
  );
}