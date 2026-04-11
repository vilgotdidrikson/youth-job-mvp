"use client";

interface SuggestionChipProps {
  label: string;
  selected?: boolean;
  onClick: () => void;
}

export function SuggestionChip({ label, selected = false, onClick }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`profile-chip profile-chip-suggestion ${selected ? "profile-chip-active" : ""}`}
      aria-pressed={selected}
    >
      {selected && <span aria-hidden>✓</span>}
      <span>{label}</span>
    </button>
  );
}
