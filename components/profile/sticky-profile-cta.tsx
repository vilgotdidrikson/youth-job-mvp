"use client";

interface StickyProfileCtaProps {
  completion: number;
  saving: boolean;
  onSave: () => void;
  primaryLabel: string;
  helperLabel: string;
}

export function StickyProfileCta({
  completion,
  saving,
  onSave,
  primaryLabel,
  helperLabel,
}: StickyProfileCtaProps) {
  return (
    <div className="sticky-profile-cta" role="region" aria-label="Save profile actions">
      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{helperLabel}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="cta-btn min-h-12 flex-1 px-4 py-3 text-sm" onClick={onSave}>
          {saving ? "Saving..." : primaryLabel}
        </button>
        <span style={{ borderRadius: 10, background: "var(--color-surface-rose)", padding: "0.5rem 0.65rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {completion}%
        </span>
      </div>
    </div>
  );
}
