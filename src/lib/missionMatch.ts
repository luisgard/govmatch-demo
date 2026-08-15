import type { StartupProfile } from "./types";

/**
 * Deterministic MISSION-vs-DOMAIN check (code-owned, consistent for EVERY sector).
 *
 * Problem this solves: relying on the LLM alone to flag "outside the agency's
 * mission" is inconsistent — it catches aerospace/cyber but misses others (e.g.
 * a water-infrastructure company vs NIH). This module makes the check uniform:
 * an agency with a narrow, well-defined mission (e.g. NIH = health/biomedical)
 * may only be a strong/moderate strategic fit if the APPLICANT'S domain genuinely
 * intersects that mission. Otherwise it is capped to "low" — identically for
 * water, aerospace, cybersecurity, agriculture, or anything else.
 *
 * It is TABLE-DRIVEN, not sector-special-cased: add an agency mission + its
 * domain lexicon and the same rule applies. Agencies with broad missions (NSF,
 * DOE, DOD…) are intentionally absent — for those, topic fit is left to the LLM.
 */

export interface AgencyMission {
  /** Human label for the mission domain (for reasons/debugging). */
  domain: string;
  /** Matches the opportunity's `agency` string for agencies with THIS mission. */
  agency: RegExp;
  /**
   * Applicant-domain signals that count as "genuinely intersects this mission".
   * If the applicant text contains NONE of these, it's a mismatch → cap to low.
   */
  applicantKeywords: string[];
}

/**
 * Narrow-mission agencies. Seeded with the health/biomedical family (NIH + its
 * Institutes/Centers + the HHS health agencies). Everything here shares ONE rule.
 */
export const AGENCY_MISSIONS: AgencyMission[] = [
  {
    domain: "health/biomedical",
    agency:
      /national institutes? of health|\bnih\b|health and human services|\bhhs\b|\bahrq\b|agency for healthcare|food and drug administration|\bfda\b|centers? for disease|\bcdc\b|\bhrsa\b|\bsamhsa\b|national cancer institute|\bnci\b|national library of medicine|\bnlm\b|national institute of|national heart|national eye institute|\bnimh\b|\bniaid\b|\bnigms\b|\bninds\b|\bnhlbi\b|\bnibib\b|\bniddk\b|\bnida\b|\bnichd\b/i,
    applicantKeywords: [
      "health",
      "healthcare",
      "biomed",
      "medical",
      "medicine",
      "clinic",
      "disease",
      "patient",
      "therap",
      "diagnos",
      "drug",
      "pharma",
      "biolog",
      "genom",
      "genetic",
      "cancer",
      "oncolog",
      "neuro",
      "cardio",
      "vaccine",
      "telehealth",
      "telemedicine",
      "mental health",
      "behavioral health",
      "nursing",
      "wellness",
      "hospital",
      "epidemi",
      "immun",
      "digital health",
      "medtech",
      "medical device",
      "life science",
      "physiolog",
      "surgical",
      "rehab",
      "aging",
      "pediatric",
      "maternal",
      "public health",
      "biotech",
    ],
  },
];

/** Combine the applicant's declared domain into one lowercase haystack. */
export function applicantDomainText(profile: StartupProfile | null | undefined): string {
  if (!profile) return "";
  return [profile.industry, profile.fundingNeed, profile.useOfFunds]
    .filter(Boolean)
    .join("  ")
    .toLowerCase();
}

export interface MissionMatchResult {
  /** True → the applicant's domain does NOT intersect this agency's mission. */
  mismatch: boolean;
  /** The mission domain that was checked, or null if the agency isn't narrow. */
  domain: string | null;
}

/**
 * Is this (agency, applicant) a mission/domain mismatch?
 *  - Agency not in the narrow-mission table → { mismatch:false } (LLM decides fit).
 *  - Agency has a narrow mission AND the applicant text intersects it → not a
 *    mismatch (LLM may rate it high).
 *  - Agency has a narrow mission AND the applicant text does NOT intersect it →
 *    mismatch:true → caller caps strategicFit to "low".
 */
export function missionDomainMismatch(
  agency: string | null | undefined,
  applicantText: string
): MissionMatchResult {
  const a = (agency ?? "").toString();
  if (!a) return { mismatch: false, domain: null };

  for (const m of AGENCY_MISSIONS) {
    if (m.agency.test(a)) {
      const intersects = m.applicantKeywords.some((kw) => applicantText.includes(kw));
      return { mismatch: !intersects, domain: m.domain };
    }
  }
  return { mismatch: false, domain: null };
}
