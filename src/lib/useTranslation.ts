"use client";

import { useCallback, useEffect, useState } from "react";
import type { Language } from "./types";
import { getDict, translations } from "./translations";

const STORAGE_KEY = "govmatch_language";

/**
 * Simple language hook. Persists the choice in localStorage and exposes the
 * active dictionary. No i18n routing libraries — just a dictionary lookup.
 */
export function useTranslation() {
  const [lang, setLangState] = useState<Language>("en");

  // Load saved language on mount (client-only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "en" || saved === "es") {
        setLangState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = getDict(lang);

  return { lang, setLang, t } as {
    lang: Language;
    setLang: (l: Language) => void;
    t: (typeof translations)["en"];
  };
}
