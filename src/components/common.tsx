"use client";

import { useState } from "react";
import type {
  EligibilityStatus,
  Language,
  StrategicFit,
} from "@/lib/types";
import { getDict } from "@/lib/translations";

/**
 * TWO-AXIS badge: eligibility (can you LEAD it?) and strategic fit (how well it
 * suits your stage) are shown TOGETHER and never conflated —
 * e.g. "Eligible to lead · Low strategic fit".
 */
export function MatchBadge({
  fit,
  eligibility,
  lang,
}: {
  fit: StrategicFit;
  eligibility: EligibilityStatus;
  lang: Language;
}) {
  const t = getDict(lang);

  const elig: Record<EligibilityStatus, { label: string; cls: string }> = {
    eligible: { label: t.eligEligible, cls: "bg-emerald-100 text-emerald-800" },
    possible: { label: t.eligEligible, cls: "bg-emerald-100 text-emerald-800" },
    ineligible: { label: t.eligIneligible, cls: "bg-red-100 text-red-800" },
    premature: { label: t.eligPremature, cls: "bg-orange-100 text-orange-800" },
    requires_verification: {
      label: t.eligVerify,
      cls: "bg-amber-100 text-amber-800",
    },
  };
  const fitMap: Record<StrategicFit, { label: string; cls: string }> = {
    high: { label: t.fitHigh, cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    moderate: { label: t.fitModerate, cls: "bg-slate-100 text-slate-600 border border-slate-200" },
    low: { label: t.fitLow, cls: "bg-slate-100 text-slate-500 border border-slate-200" },
  };

  const e = elig[eligibility] ?? elig.requires_verification;
  // Fit is meaningful when the founder can (potentially) lead it.
  const showFit = eligibility === "eligible" || eligibility === "premature";

  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <span className={`badge ${e.cls}`}>{e.label}</span>
      {showFit && <span className={`badge ${fitMap[fit].cls}`}>{fitMap[fit].label}</span>}
    </span>
  );
}

/** Copy-to-clipboard button that shows a transient "Copied!" state. */
export function CopyButton({
  text,
  lang,
  label,
  className,
}: {
  text: string;
  lang: Language;
  label?: string;
  className?: string;
}) {
  const t = getDict(lang);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className ?? "btn-secondary text-sm"}
    >
      {copied ? `✓ ${t.copied}` : `⧉ ${label ?? t.copy}`}
    </button>
  );
}

/** A labeled section header used across detail/wizard screens. */
export function SectionHeader({
  icon,
  children,
}: {
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </h3>
  );
}
