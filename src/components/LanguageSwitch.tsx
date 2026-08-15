"use client";

import type { Language } from "@/lib/types";

/** ES/EN toggle, shown top-right on every screen. */
export function LanguageSwitch({
  lang,
  setLang,
}: {
  lang: Language;
  setLang: (l: Language) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm"
      role="group"
      aria-label="Language"
    >
      {(["en", "es"] as Language[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-3 py-1.5 font-semibold transition ${
            lang === code
              ? "bg-brand-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
