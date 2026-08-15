import type { Language, Opportunity } from "./types";
import { awardParts, formatMoney } from "./format";
import { deriveActivityCode } from "./eligibility";
import { isNihSbirParent, programReferenceText } from "./programReference";

/**
 * ONE place that decides how an opportunity's award is displayed. Uses ONLY the
 * opportunity's own official figures; program-level reference (NIH SBIR parents)
 * is always flagged "standard program amounts, not from this FOA — verify". R01
 * figures are reframed as per-year + multi-year so a founder doesn't read the
 * annual cap as a one-time total.
 */
export interface AwardDisplay {
  label: string;
  value: string;
  /** Visible note explaining an asterisk / caveat, or null. */
  footnote: string | null;
  /** When true, `value` should be a link to the opportunity's sourceUrl. */
  asLink: boolean;
}

function isR01(opp: Opportunity): boolean {
  const code = (opp.activityCode ?? deriveActivityCode(opp.title, opp.opportunityNumber) ?? "").toUpperCase();
  return code === "R01" || /\bR01\b/i.test(opp.title ?? "");
}

export function describeAwardDisplay(opp: Opportunity, lang: Language): AwardDisplay {
  const t = programReferenceText(lang);
  const parts = awardParts(opp.awardFloor, opp.awardCeiling);
  const labelRange = lang === "es" ? "Rango del monto" : "Award range";
  const labelCeiling = lang === "es" ? "Monto máximo" : "Award ceiling";
  const labelFloor = lang === "es" ? "Monto mínimo" : "Award floor";

  // R01: the ceiling is an ANNUAL direct-cost figure over a multi-year project.
  if (isR01(opp) && opp.awardCeiling != null) {
    const perYear = formatMoney(opp.awardCeiling);
    const totalEst = formatMoney(opp.awardCeiling * 5);
    return {
      label: labelCeiling,
      value:
        lang === "es"
          ? `~${perYear}/año (típicamente 4-5 años) *`
          : `~${perYear}/year (typically 4-5 years) *`,
      footnote:
        lang === "es"
          ? `* Estimado ~${totalEst} en total en ~5 años (monto anual × 5).`
          : `* Est. ~${totalEst} total over ~5 years (annual figure × 5).`,
      asLink: false,
    };
  }

  // Official floor/ceiling from THIS FOA.
  if (parts.kind === "range")
    return { label: labelRange, value: parts.value, footnote: null, asLink: false };
  if (parts.kind === "ceiling")
    return { label: labelCeiling, value: parts.value, footnote: null, asLink: false };
  if (parts.kind === "floor")
    return { label: labelFloor, value: parts.value, footnote: null, asLink: false };

  // No official figure: NIH SBIR/STTR parent → standard program amounts (flagged).
  if (isNihSbirParent(opp)) {
    return {
      label: labelRange,
      value: t.awardStandard,
      footnote: t.awardFootnote,
      asLink: false,
    };
  }

  // Otherwise link to the FOA (never a bare "Not specified", never another number).
  return { label: labelRange, value: t.seeFoa, footnote: null, asLink: true };
}
