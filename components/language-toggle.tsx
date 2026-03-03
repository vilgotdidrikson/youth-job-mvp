"use client";

import { SiteLanguage } from "@/hooks/use-language";

interface LanguageToggleProps {
  language: SiteLanguage;
  onToggle: () => void;
}

export function LanguageToggle({ language, onToggle }: LanguageToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-xl border border-[#cfe2ff] bg-white/95 px-3 py-2 text-xs font-semibold text-[#2f5d90] shadow-sm backdrop-blur"
      aria-label={language === "sv" ? "Byt språk till engelska" : "Switch language to Swedish"}
      title={language === "sv" ? "Byt till engelska" : "Switch to Swedish"}
    >
      {language === "sv" ? "Svenska â€¢ EN" : "English â€¢ SV"}
    </button>
  );
}

