import type { EligibilityReason, EligibilityStatus, Opportunity } from "./types";

/**
 * EVIDENCE-BASED eligibility, PARAMETERIZED on the user's entity type.
 *
 * Hard rule: eligibility is determined ONLY from the SPECIFIC opportunity's
 * official data — its declared applicant types + eligibility text — judged
 * against the USER'S declared entity type. The check is symmetric: an
 * opportunity is eligible for whoever its applicantTypes include. A university's
 * natural R01 is "eligible" for a university and "ineligible" for a for-profit
 * startup, from the SAME code path. Uncertainty → `requires_verification`, never
 * a fabricated "ineligible". Every result carries traceable reasons.
 */

/** Entity types the user can pick (mapped to Grants.gov applicant categories). */
export type EntityType =
  | "small_business"
  | "higher_education"
  | "k12"
  | "nonprofit"
  | "government"
  | "other";

export const ENTITY_TYPES: EntityType[] = [
  "small_business",
  "higher_education",
  "k12",
  "nonprofit",
  "government",
  "other",
];

export function normalizeEntityType(v: unknown): EntityType {
  return typeof v === "string" && (ENTITY_TYPES as string[]).includes(v)
    ? (v as EntityType)
    : "small_business";
}

/** Regex matched against a FOA's declared applicant-type descriptions. */
const ENTITY_MATCHERS: Record<EntityType, RegExp | null> = {
  small_business: /small business|for[\s-]?profit/i,
  higher_education: /institutions? of higher education|higher education|universit|college/i,
  k12: /school district|independent school|elementary|secondary|k-?12/i,
  nonprofit: /nonprofit|non-profit|501\(c\)/i,
  government: /\bgovernment|municipal|county|city or township|special district/i,
  other: null, // "not sure" → cannot be determined → requires_verification
};

const ENTITY_LABELS: Record<EntityType, string> = {
  small_business: "For-profit small business",
  higher_education: "Institution of higher education",
  k12: "K-12 school / school district",
  nonprofit: "Nonprofit organization",
  government: "State or local government",
  other: "Your organization",
};

/** Parse the activity code from the title/number — used only for EXPLANATION. */
export function deriveActivityCode(
  title: string | null,
  number?: string | null
): string | null {
  const hay = `${title ?? ""} ${number ?? ""}`;
  const m = /\b(R\d{2}|U\d{2}|P\d{2}|K\d{2}|T\d{2}|F\d{2}|RM\d|DP\d|UG3|UH3|RF1|RL1|SB1)\b/i.exec(hay);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Structural mechanism class from the activity code / title. Used for the SBIR/
 * STTR structural eligibility rule and the research-mechanism strategic-fit cap.
 * Applied the SAME way to every opportunity.
 */
export type MechanismClass = "sbir" | "sttr" | "research" | "other";

export function mechanismClass(opp: {
  title: string | null;
  opportunityNumber?: string;
  activityCode?: string | null;
}): MechanismClass {
  const code = (opp.activityCode ?? deriveActivityCode(opp.title, opp.opportunityNumber) ?? "").toUpperCase();
  const title = (opp.title ?? "").toLowerCase();
  if (/\bsttr\b|small business technology transfer/.test(title) || code === "R41" || code === "R42")
    return "sttr";
  if (/\bsbir\b|small business innovation research/.test(title) || code === "R43" || code === "R44" || code === "SB1")
    return "sbir";
  // Institutional research / center / career / training / cooperative mechanisms.
  if (
    /^R(0[013]|15|21|33|34|35|37|61|00)$/.test(code) ||
    code === "RF1" ||
    code === "RL1" ||
    /^DP\d$/.test(code) ||
    /^P\d{2}$/.test(code) ||
    /^U/.test(code) ||
    /^K\d{2}$/.test(code) ||
    /^(T|F)\d{2}$/.test(code) ||
    /^RM\d$/.test(code)
  ) {
    return "research";
  }
  return "other";
}

/** Is this mechanism a research/institutional one (low fit for a commercial startup)? */
export function isResearchMechanism(opp: {
  title: string | null;
  opportunityNumber?: string;
  activityCode?: string | null;
}): boolean {
  return mechanismClass(opp) === "research";
}

export interface EligibilityAssessment {
  status: EligibilityStatus;
  reasons: EligibilityReason[];
}

/**
 * Assess whether the given entity type may LEAD an application to this FOA.
 */
export function assessEligibility(
  opp: Opportunity,
  entityType: EntityType = "small_business",
  profile?: { employees?: string | null; hasPriorPhaseII?: boolean } | null
): EligibilityAssessment {
  const reasons: EligibilityReason[] = [];
  const types = opp.applicantTypes ?? [];
  const typesKnown = types.length > 0;
  const companyFact = describeEntity(entityType, profile);
  const matcher = ENTITY_MATCHERS[entityType];
  const mech = mechanismClass(opp);

  let status: EligibilityStatus;

  // 1a) STRUCTURAL rule for SBIR/STTR: by statute these are led by a small
  //     business / for-profit — not by universities, nonprofits, or governments.
  //     Applied consistently, and works even when applicantTypes are absent.
  if (mech === "sbir" || mech === "sttr") {
    if (entityType === "small_business") {
      status = "eligible";
      reasons.push({
        requirement: `${mech.toUpperCase()} is led by a small business / for-profit`,
        companyFact,
        result: "passes",
        source: "Program structure (SBIR/STTR statute)",
      });
    } else if (entityType === "other") {
      status = "requires_verification";
      reasons.push({
        requirement: `${mech.toUpperCase()} is a small-business program`,
        companyFact,
        result: "unknown",
        source: "Program structure (SBIR/STTR statute)",
      });
    } else {
      status = "ineligible";
      reasons.push({
        requirement: `${mech.toUpperCase()} must be led by a small business / for-profit`,
        companyFact,
        result: "fails",
        source: "Program structure (SBIR/STTR statute)",
      });
    }
  }
  // 1b) Everything else: applicant-type check against the USER'S entity type.
  else if (!typesKnown || matcher === null) {
    status = "requires_verification";
    reasons.push({
      requirement: typesKnown
        ? `Eligible applicants: ${previewTypes(types)}`
        : "Eligible applicant types (not provided by the source)",
      companyFact,
      result: "unknown",
      source: "Grants.gov applicant types",
    });
  } else if (types.some((t) => matcher.test(t))) {
    status = "eligible";
    reasons.push({
      requirement: `Eligible applicants include your type: ${previewTypes(types)}`,
      companyFact,
      result: "passes",
      source: "Grants.gov applicant types",
    });
  } else {
    status = "ineligible";
    reasons.push({
      requirement: `Eligible applicants: ${previewTypes(types)}`,
      companyFact,
      result: "fails",
      source: "Grants.gov applicant types",
    });
  }

  // 2) Prior-Phase-II prerequisite (Phase IIB / Bridge) → PREMATURE, not a vague
  //    "requires verification". If the profile indicates no prior Phase II, it's a
  //    KNOWN fact; if unknown, name the specific thing to confirm.
  const prereq = detectPriorPhaseII(opp);
  if (prereq && status !== "ineligible") {
    const knownNo = profile?.hasPriorPhaseII === false;
    reasons.push({
      requirement: prereq,
      companyFact: knownNo
        ? "Your profile indicates you do NOT have a prior Phase II award"
        : "Prior Phase II award status not confirmed",
      result: knownNo ? "fails" : "unknown",
      source: opp.eligibility ? "FOA eligibility text" : "FOA type (title)",
    });
    status = "premature";
  }

  return { status, reasons };
}

/**
 * Backward-compatible wrapper: defaults to a for-profit small business (the
 * primary GovMatch flow). Existing callers/tests keep working unchanged.
 */
export function assessStartupEligibility(
  opp: Opportunity,
  profile?: { employees?: string | null } | null
): EligibilityAssessment {
  return assessEligibility(opp, "small_business", profile);
}

export function detectPriorPhaseII(opp: Opportunity): string | null {
  const text = `${opp.title ?? ""} ${opp.eligibility ?? ""} ${opp.description ?? ""}`;
  if (/prior\s+.{0,20}phase\s*ii|previously\s+.{0,20}phase\s*ii|active\s+phase\s*ii/i.test(text)) {
    return "Requires a prior NIH SBIR/STTR Phase II award";
  }
  if (/\bphase\s*iib\b|\bbridge\s+award/i.test(opp.title ?? "")) {
    return "Phase IIB / Bridge award — requires a prior NIH SBIR/STTR Phase II award";
  }
  return null;
}

function describeEntity(
  entityType: EntityType,
  profile?: { employees?: string | null } | null
): string {
  const base = ENTITY_LABELS[entityType] ?? ENTITY_LABELS.other;
  if (entityType === "small_business" && profile?.employees) {
    return `${base} (~${profile.employees} employees)`;
  }
  return base;
}

function previewTypes(types: string[]): string {
  const shown = types.slice(0, 3).join(", ");
  return types.length > 3 ? `${shown}…` : shown;
}
