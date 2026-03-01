"use client";

import { useEffect, useState } from "react";

export type SiteLanguage = "sv" | "en";

const LANGUAGE_KEY = "workspot_language";
const LANGUAGE_CHANGED_EVENT = "workspot_language_changed";

function readStoredLanguage(): SiteLanguage {
  if (typeof window === "undefined") {
    return "sv";
  }

  const value = window.localStorage.getItem(LANGUAGE_KEY);
  return value === "en" ? "en" : "sv";
}

export function useLanguage() {
  const [language, setLanguageState] = useState<SiteLanguage>("sv");

  useEffect(() => {
    const syncLanguage = () => {
      const nextLanguage = readStoredLanguage();
      setLanguageState(nextLanguage);
      if (typeof document !== "undefined") {
        document.documentElement.lang = nextLanguage;
      }
    };

    syncLanguage();

    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);
    };
  }, []);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    if (typeof document !== "undefined") {
      document.documentElement.lang = nextLanguage;
    }
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
  };

  const toggleLanguage = () => {
    setLanguage(language === "sv" ? "en" : "sv");
  };

  return { language, setLanguage, toggleLanguage };
}
