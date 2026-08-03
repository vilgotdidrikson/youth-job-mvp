"use client";

import { ReactNode } from "react";

interface ProfileSectionCardProps {
  id: string;
  title: string;
  helperText: string;
  completed: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ProfileSectionCard({
  id,
  title,
  helperText,
  completed,
  open,
  onToggle,
  children,
}: ProfileSectionCardProps) {
  return (
    <section className="profile-section">
      <button
        type="button"
        className="profile-section-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <div>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
          <p style={{ marginTop: "0.2rem", fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0.2rem 0 0" }}>{helperText}</p>
        </div>
        <span className={`profile-status-chip ${completed ? "profile-status-complete" : ""}`}>
          {completed ? "Done" : "In progress"}
        </span>
      </button>

      {open && (
        <div id={id} className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      )}
    </section>
  );
}
