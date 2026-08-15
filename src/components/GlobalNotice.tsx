"use client";

import type { Language } from "@/lib/types";
import { getDict } from "@/lib/translations";

/** The always-visible AI-disclaimer banner (challenge requirement). */
export function GlobalNotice({ lang }: { lang: Language }) {
  const t = getDict(lang);
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-xs text-amber-900">
        <span aria-hidden>⚠️</span>
        <p>{t.globalNotice}</p>
      </div>
    </div>
  );
}
