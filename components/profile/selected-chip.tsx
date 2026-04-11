"use client";

interface SelectedChipProps {
  label: string;
  onRemove: () => void;
}

export function SelectedChip({ label, onRemove }: SelectedChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="profile-chip profile-chip-selected"
      aria-label={`Remove ${label}`}
      title={`Remove ${label}`}
    >
      <span aria-hidden>✓</span>
      <span>{label}</span>
      <span aria-hidden>×</span>
    </button>
  );
}
