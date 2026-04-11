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
      <p className="text-xs text-[#44648b]">{helperLabel}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="cta-btn min-h-12 flex-1 px-4 py-3 text-sm" onClick={onSave}>
          {saving ? "Saving..." : primaryLabel}
        </button>
        <span className="rounded-xl bg-[#e7f1ff] px-3 py-2 text-xs font-semibold text-[#1a4a80]">
          {completion}%
        </span>
      </div>
    </div>
  );
}
