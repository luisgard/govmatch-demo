"use client";

import type { Language } from "@/lib/types";
import { getDict } from "@/lib/translations";
import { LanguageSwitch } from "./LanguageSwitch";

export function Header({
  lang,
  setLang,
  onHome,
}: {
  lang: Language;
  setLang: (l: Language) => void;
  onHome?: () => void;
}) {
  const t = getDict(lang);
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 text-left"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-lg text-white"
            aria-hidden
          >
            🏛️
          </span>
          <span className="ml-1">
            <span className="block text-lg font-extrabold leading-tight text-slate-900">
              {t.appName}
            </span>
            <span className="block text-xs text-slate-500">{t.tagline}</span>
          </span>
        </button>
        <LanguageSwitch lang={lang} setLang={setLang} />
      </div>
    </header>
  );
}
