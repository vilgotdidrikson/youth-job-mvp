"use client";

interface ProfileProgressCardProps {
  completion: number;
  statusText: string;
  title: string;
  subtitle: string;
}

export function ProfileProgressCard({
  completion,
  statusText,
  title,
  subtitle,
}: ProfileProgressCardProps) {
  return (
    <section className="card" style={{ padding: "1.25rem", marginBottom: "0.25rem" }}>
      <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a3a3a3", margin: 0 }}>Profile</p>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: "0.2rem 0 0", lineHeight: 1.15 }}>{title}</h1>
      <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "#737373" }}>{subtitle}</p>

      <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 600, color: "#4a4a4a", marginBottom: "0.4rem" }}>
          <span>{statusText}</span>
          <span>{completion}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "#f0f0f0", overflow: "hidden" }}>
          <div
            style={{ width: `${completion}%`, height: "100%", borderRadius: 999, background: "#111111", transition: "width 0.3s ease" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
            aria-label="Profile completion"
          />
        </div>
      </div>
    </section>
  );
}
