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
          <h2 className="text-base font-semibold text-[#132742]">{title}</h2>
          <p className="mt-1 text-sm text-[#456487]">{helperText}</p>
        </div>
        <span className={`profile-status-chip ${completed ? "profile-status-complete" : ""}`}>
          {completed ? "Done" : "In progress"}
        </span>
      </button>

      {open && (
        <div id={id} className="mt-3 border-t border-[#e2ecff] pt-3">
          {children}
        </div>
      )}
    </section>
  );
}
