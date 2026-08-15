import type {
  EligibilityReason,
  EligibilityStatus,
  MatchCounts,
  OpportunityMatch,
  StrategicFit,
} from "./types";
import type { MechanismClass } from "./eligibility";

/**
 * Pure, testable match logic. TWO SEPARATE AXES, one consistent rule for all:
 *   - eligibilityStatus (code): can this entity LEAD it?
 *   - strategicFit (Claude, code-capped): how well it suits the applicant's stage.
 * strategicFit never changes eligibilityStatus and vice-versa; both are shown.
 * Claude supplies FIT prose only; the app supplies every FACT.
 */

export function normalizeFit(s: unknown): StrategicFit {
  return s === "high" || s === "moderate" || s === "low" ? s : "moderate";
}

/** Sort so eligible + high-fit float up; ineligible/premature/verify sink. */
export function sortKey(m: OpportunityMatch): number {
  const eRank: Record<EligibilityStatus, number> = {
    eligible: 0,
    possible: 1,
    requires_verification: 2,
    premature: 3,
    ineligible: 4,
  };
  const fRank: Record<StrategicFit, number> = { high: 0, moderate: 1, low: 2 };
  return eRank[m.eligibilityStatus] * 10 + fRank[m.strategicFit];
}

/**
 * Build final matches: Claude's FIT prose + CODE's eligibility. Any award/
 * deadline/url/count an LLM tries to include is discarded (no such fields exist
 * on OpportunityMatch). Unknown ids dropped.
 */
export function buildMatches(
  rawMatches: unknown,
  reviewedIds: Set<string>,
  eligById: Map<string, { status: EligibilityStatus; reasons: EligibilityReason[] }>
): OpportunityMatch[] {
  const out: OpportunityMatch[] = [];
  const seen = new Set<string>();
  const arr = Array.isArray(rawMatches) ? rawMatches : [];
  for (const raw of arr) {
    const m = raw as { id?: unknown; strategicFit?: unknown } & Record<string, unknown>;
    const id = typeof m?.id === "string" ? m.id : "";
    if (!id || !reviewedIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const elig = eligById.get(id);
    out.push({
      id,
      strategicFit: normalizeFit(m.strategicFit),
      eligibilityStatus: elig?.status ?? "requires_verification",
      eligibilityReasons: elig?.reasons ?? [],
      whyItMatches: asPointArray(m.whyItMatches),
      whyItMayNotMatch: asDetailArray(m.whyItMayNotMatch),
      possibleBlockers: asDetailArray(m.possibleBlockers),
      whatToVerify: asDetailArray(m.whatToVerify),
      nextSteps: asDetailArray(m.nextSteps),
    });
  }
  out.sort((a, b) => sortKey(a) - sortKey(b));
  return out;
}

/**
 * Consistent CODE cap on strategic fit: a research/institutional mechanism
 * (R01/R21/P/U/RM1/K/T/F…) for a COMMERCIAL applicant (small business) is "low"
 * fit — it needs an academic PI + research infrastructure. Applied to ALL such
 * mechanisms identically (fixes the R01-vs-BTOD inconsistency). Does NOT touch
 * eligibilityStatus.
 */
export function applyStrategicFitCap(
  matches: OpportunityMatch[],
  mechById: Map<string, MechanismClass>,
  entityType: string
): OpportunityMatch[] {
  if (entityType !== "small_business") return matches;
  const out = matches.map((m) =>
    mechById.get(m.id) === "research" ? { ...m, strategicFit: "low" as StrategicFit } : m
  );
  out.sort((a, b) => sortKey(a) - sortKey(b));
  return out;
}

/**
 * Domain-match cap: when the applicant's domain is clearly OUTSIDE the funding
 * agency's core mission (Claude flags this per opportunity), strategic fit is
 * "low" — never "moderate/high" — so the badge can never contradict a summary
 * that says the work sits outside the agency's mission. Eligibility is untouched.
 */
export function applyDomainMismatchCap(
  matches: OpportunityMatch[],
  outsideMissionIds: Set<string>,
  reason: string
): OpportunityMatch[] {
  const out = matches.map((m) =>
    outsideMissionIds.has(m.id)
      ? {
          ...m,
          strategicFit: "low" as StrategicFit,
          whyItMayNotMatch: prepend(m.whyItMayNotMatch, reason),
        }
      : m
  );
  out.sort((a, b) => sortKey(a) - sortKey(b));
  return out;
}

/**
 * Put a plain, non-softened eligibility statement FIRST in "whyItMayNotMatch"
 * whenever the founder cannot straightforwardly lead the opportunity. This does
 * NOT change any axis — it only makes the reason explicit.
 */
export function annotateEligibility(
  matches: OpportunityMatch[],
  phrases: { ineligible: string; premature: string; verify: string }
): OpportunityMatch[] {
  return matches.map((m) => {
    const detail =
      m.eligibilityStatus === "ineligible"
        ? phrases.ineligible
        : m.eligibilityStatus === "premature"
        ? phrases.premature
        : m.eligibilityStatus === "requires_verification"
        ? phrases.verify
        : null;
    if (!detail) return m;
    return { ...m, whyItMayNotMatch: prepend(m.whyItMayNotMatch, detail) };
  });
}

function prepend(list: { detail: string }[], detail: string): { detail: string }[] {
  const arr = Array.isArray(list) ? list : [];
  if (arr.some((x) => x.detail === detail)) return arr;
  return [{ detail }, ...arr];
}

/** Counts computed from the EXACT displayed match array — never from Claude. */
export function computeCounts(reviewed: number, matches: OpportunityMatch[]): MatchCounts {
  const by = (p: (m: OpportunityMatch) => boolean) => matches.filter(p).length;
  return {
    reviewed,
    shown: matches.length,
    filtered: Math.max(0, reviewed - matches.length),
    highFit: by((m) => m.strategicFit === "high"),
    moderateFit: by((m) => m.strategicFit === "moderate"),
    lowFit: by((m) => m.strategicFit === "low"),
    eligible: by((m) => m.eligibilityStatus === "eligible"),
    ineligibleOrVerify: by(
      (m) => m.eligibilityStatus !== "eligible" && m.eligibilityStatus !== "possible"
    ),
  };
}

/** Belt-and-suspenders: strip stray digit-counts from Claude's prose summary. */
export function stripNumbers(summary: string): string {
  return stripMarkdown(
    summary.replace(/\b\d+\s+(opportunit|program|grant|match|award)\w*/gi, "several $1s")
  );
}

/**
 * Remove any Markdown syntax so it can never render as literal text in the UI:
 * a markdown link becomes its visible text, and emphasis/code markers are dropped.
 */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links -> visible text only
    .replace(/[*_]{1,3}/g, "") // bold / italic markers
    .replace(/`/g, "") // backtick / code markers
    .trim();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function asDetailArray(v: any): { detail: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({
      detail: stripMarkdown(typeof x?.detail === "string" ? x.detail : String(x?.detail ?? "")),
    }))
    .filter((x) => x.detail);
}
function asPointArray(v: any): { dimension: string; status: string; detail: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({
      dimension: stripMarkdown(String(x?.dimension ?? "")),
      status: String(x?.status ?? "✓"),
      detail: stripMarkdown(String(x?.detail ?? "")),
    }))
    .filter((x) => x.dimension || x.detail);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
