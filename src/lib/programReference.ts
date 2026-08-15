import type { Language, Opportunity } from "./types";
import { mechanismClass } from "./eligibility";

/**
 * PROGRAM-LEVEL reference data (NIH SBIR/STTR), used ONLY to enrich the display
 * when the FOA itself provides no per-award figure. It is ALWAYS labelled as
 * "standard program amounts, not from this FOA — verify current limits", so it is
 * never mistaken for the opportunity's own official figure, and it is scoped to
 * NIH SBIR/STTR PARENT solicitations only (never applied to NSF or others).
 *
 * Figures are the NIH statutory guideline (adjusted annually; higher budgets need
 * a waiver). They are approximate and explicitly flagged "verify current limits".
 */
export const NIH_SBIR_REFERENCE = {
  phase1Approx: "~$314K",
  phase2Approx: "~$2.09M",
  standardCycles: "Jan 5 · Apr 5 · Sep 5",
  officialUrl:
    "https://seed.nih.gov/small-business-funding/small-business-program-basics/understanding-sbir-sttr",
} as const;

/** True only for an NIH (not NSF/other) SBIR/STTR parent/omnibus solicitation. */
export function isNihSbirParent(opp: Opportunity): boolean {
  const agency = (opp.agency ?? "").toLowerCase();
  const isNih = /national institutes of health|\bnih\b/.test(agency);
  const mech = mechanismClass(opp);
  const isSbir = mech === "sbir" || mech === "sttr";
  const isParent = /\bparent\b|omnibus/i.test(opp.title ?? "");
  return isNih && isSbir && isParent;
}

/** Next standard NIH SBIR/STTR due date (Jan 5 · Apr 5 · Sep 5), from today. */
export function nextStandardCycle(): string {
  const now = new Date();
  const y = now.getFullYear();
  const candidates = [
    new Date(y, 0, 5),
    new Date(y, 3, 5),
    new Date(y, 8, 5),
    new Date(y + 1, 0, 5),
  ];
  const next = candidates.find((d) => d.getTime() >= now.getTime()) ?? candidates[0];
  return next.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function programReferenceText(lang: Language) {
  if (lang === "es") {
    return {
      awardStandard: `Fase I ${NIH_SBIR_REFERENCE.phase1Approx} / Fase II ${NIH_SBIR_REFERENCE.phase2Approx} *`,
      awardFootnote:
        "* Montos estándar del programa NIH SBIR/STTR, NO de este FOA — verifica los límites vigentes.",
      deadlineStandard: `Ciclos estándar: ${NIH_SBIR_REFERENCE.standardCycles} — confirma la fecha aplicable en el FOA`,
      nextCyclePrefix: "Próximo ciclo ~",
      foaExpires: "El FOA expira",
      seeFoa: "Consulta los detalles de financiamiento en el FOA",
      verifyLink: "Entender SBIR/STTR (NIH) — verifica montos vigentes",
    };
  }
  return {
    awardStandard: `Phase I ${NIH_SBIR_REFERENCE.phase1Approx} / Phase II ${NIH_SBIR_REFERENCE.phase2Approx} *`,
    awardFootnote:
      "* Standard NIH SBIR/STTR program amounts, NOT from this FOA — verify current limits.",
    deadlineStandard: `Standard cycles: ${NIH_SBIR_REFERENCE.standardCycles} — confirm the applicable date in the FOA`,
    nextCyclePrefix: "Next cycle ~",
    foaExpires: "FOA expires",
    seeFoa: "See funding details in the FOA",
    verifyLink: "Understanding SBIR/STTR (NIH) — verify current amounts",
  };
}
