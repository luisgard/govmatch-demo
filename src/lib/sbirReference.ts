import type { Language } from "./types";

/**
 * Hardcoded OFFICIAL reference data for SBIR/STTR — the same "code owns the fixed
 * official facts" pattern as OFFICIAL_LINKS and the base-registration constants.
 *
 * Parent/omnibus SBIR solicitations do not carry a per-award ceiling in the API
 * (it shows as "Not specified"), and their listed date is the FOA EXPIRATION, not
 * an application deadline. These standard NIH figures/cycles fill that gap, and
 * are explicitly framed as "verify the current amounts/cycle" — Claude never
 * produces them.
 *
 * Amounts are the NIH statutory guideline (adjusted annually; higher budgets need
 * a waiver). Standard due dates apply to most (not all) ICs.
 */
export const SBIR_REFERENCE = {
  officialUrl:
    "https://seed.nih.gov/small-business-funding/small-business-program-basics/understanding-sbir-sttr",
  phase1AmountApprox: "≈ $314,000",
  phase2AmountApprox: "≈ $2.09M",
  guideRange: "≈ $314K – $2.09M",
  standardCycles: "Jan 5 · Apr 5 · Sep 5",
} as const;

/** Compact award label for SBIR/STTR cards when the FOA gives no per-award figure. */
export function sbirAwardLabel(lang: Language): string {
  return lang === "es"
    ? `Fase I ${SBIR_REFERENCE.phase1AmountApprox} / Fase II ${SBIR_REFERENCE.phase2AmountApprox} (NIH estándar*)`
    : `Phase I ${SBIR_REFERENCE.phase1AmountApprox} / Phase II ${SBIR_REFERENCE.phase2AmountApprox} (NIH standard*)`;
}

/**
 * The next standard NIH SBIR/STTR new-application due date (Jan 5 · Apr 5 · Sep 5),
 * computed from today. These are the official standard cycles (AIDS-related and
 * some ICs differ — hence "verify").
 */
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

/**
 * Compact deadline label for SBIR/STTR cards: leads with the NEXT standard cycle
 * (what the founder actually needs), not the FOA expiration date the API returns.
 */
export function sbirDeadlineLabel(lang: Language): string {
  const next = nextStandardCycle();
  return lang === "es"
    ? `Próximo ciclo ~${next} (Ene · Abr · Sep)`
    : `Next cycle ~${next} (Jan · Apr · Sep)`;
}

export function sbirReferenceText(lang: Language) {
  if (lang === "es") {
    return {
      heading: "Referencia estándar SBIR/STTR",
      ranges: `Fase I ${SBIR_REFERENCE.phase1AmountApprox} (~6-12 meses) · Fase II ${SBIR_REFERENCE.phase2AmountApprox} (~2 años)`,
      cycles: `Ciclos de solicitud estándar: ${SBIR_REFERENCE.standardCycles}`,
      deadlineNote:
        "La fecha mostrada es la EXPIRACIÓN del anuncio, no un plazo de solicitud. Se aplica en ciclos estándar — confirma tu ciclo y los montos vigentes.",
      icNote:
        "La estrategia real ocurre a nivel de Instituto/Centro del NIH (p. ej. NIBIB, NLM, NCI según tu producto). Confirma el IC y su Program Officer.",
      verify: "Cifras guía del NIH (se ajustan cada año) — verifica las vigentes",
      evidenceNote:
        "Los datos históricos de USAspending para este tema son subvenciones estatales masivas, NO comparables con premios SBIR a startups. Referencia SBIR: Fase I ~$300K–$350K. Pide ejemplos recientes en tu área al Program Officer del IC correspondiente.",
    };
  }
  return {
    heading: "Standard SBIR/STTR reference",
    ranges: `Phase I ${SBIR_REFERENCE.phase1AmountApprox} (~6-12 months) · Phase II ${SBIR_REFERENCE.phase2AmountApprox} (~2 years)`,
    cycles: `Standard application cycles: ${SBIR_REFERENCE.standardCycles}`,
    deadlineNote:
      "The date shown is the FOA EXPIRATION, not an application deadline. Applications run on standard cycles — confirm your cycle and the current amounts.",
    icNote:
      "The real strategy happens at the NIH Institute/Center level (e.g. NIBIB, NLM, NCI depending on your product). Confirm the IC and its Program Officer.",
    verify: "NIH guideline figures (adjusted annually) — verify the current ones",
    evidenceNote:
      "USAspending's historical data for this topic is large state-agency grants, NOT comparable to SBIR awards to startups. SBIR reference: Phase I ~$300K–$350K. Ask the relevant IC Program Officer for recent examples in your domain.",
  };
}
