import { NextRequest, NextResponse } from "next/server";
import { claudeJson, languageName } from "@/lib/anthropic";
import { hasUsableDetail } from "@/lib/grantsgov";
import {
  assessEligibility,
  mechanismClass,
  normalizeEntityType,
  type EntityType,
  type MechanismClass,
} from "@/lib/eligibility";
import {
  annotateEligibility,
  applyDomainMismatchCap,
  applyStrategicFitCap,
  buildMatches,
  computeCounts,
  stripNumbers,
} from "@/lib/matchLogic";
import { applicantDomainText, missionDomainMismatch } from "@/lib/missionMatch";
import type {
  HistoricalEvidence,
  Language,
  MatchCounts,
  MatchResult,
  Opportunity,
  OpportunityMatch,
  StartupProfile,
  StrategicFit,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cap how many opportunities Claude ranks per request (keeps the JSON from
// hitting the token limit and truncating).
const MAX_MATCH = 7;

/**
 * /api/match — Claude judges FIT (matchStrength); CODE owns every FACT.
 *
 * Division of responsibility (the core design principle):
 *  - CODE determines eligibility (from the opportunity's official applicant types
 *    + FOA text), award/deadline/url/fundingType (from the normalized opportunity),
 *    and ALL counts. None of these come from Claude.
 *  - Claude only produces the explanatory fit judgement (strong/possible/weak) and
 *    the "why matches / why not" prose. It cannot set facts.
 */
export async function POST(req: NextRequest) {
  let profile: StartupProfile;
  let opportunities: Opportunity[];
  let evidence: HistoricalEvidence | null;
  let language: Language = "en";
  let entityType: EntityType = "small_business";

  try {
    const body = await req.json();
    profile = body.profile ?? {};
    opportunities = Array.isArray(body.opportunities) ? body.opportunities : [];
    evidence = body.evidence ?? null;
    language = body.language === "es" ? "es" : "en";
    entityType = normalizeEntityType(body.entityType);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const emptyCounts: MatchCounts = {
    reviewed: 0,
    shown: 0,
    filtered: 0,
    highFit: 0,
    moderateFit: 0,
    lowFit: 0,
    eligible: 0,
    ineligibleOrVerify: 0,
  };

  if (opportunities.length === 0) {
    const summary =
      language === "es"
        ? "No encontramos programas de subvenciones federales abiertos que coincidan con tu descripción en este momento. Puede haber mejores opciones fuera de las subvenciones tradicionales (por ejemplo, SBIR/STTR, préstamos de la SBA o programas estatales)."
        : "We didn't find open federal grant programs matching your description right now. Better options may lie outside traditional grants (for example SBIR/STTR, SBA loans, or state programs).";
    return NextResponse.json({
      matches: [],
      counts: emptyCounts,
      honestNoMatch: true,
      summary,
    } satisfies MatchResult);
  }

  // Prefer opportunities Claude can actually evaluate; cap the count.
  const detailed = opportunities.filter(hasUsableDetail);
  const pool = detailed.length > 0 ? detailed : opportunities;
  const reviewed = pool.slice(0, MAX_MATCH);
  const reviewedById = new Map(reviewed.map((o) => [o.opportunityNumber, o]));

  // CODE computes eligibility from official data, judged against the USER'S
  // declared entity type — never Claude.
  const eligById = new Map(
    reviewed.map((o) => [o.opportunityNumber, assessEligibility(o, entityType, profile)])
  );

  const system = `You are GovMatch's matching analyst. You EXPLAIN FIT ONLY. You are NEVER the
source of truth for any fact. Write all human-readable text in ${languageName(language)}.

You receive a startup PROFILE and a list of real OPPORTUNITIES (already fetched, normalized,
and eligibility-assessed by the application).

ABSOLUTE RULES:
- Judge ONLY the opportunities provided. NEVER invent a program.
- You do NOT output award amounts, deadlines, funding types, URLs, eligibility, or any
  counts. The application owns all of those. You output ONLY "strategicFit" and prose.
- TWO SEPARATE AXES. Never conflate them:
    1. eligibilityStatus (given to you, code-computed — DO NOT restate or override it): can
       the user's organization type LEAD this opportunity?
    2. "strategicFit": "high" | "moderate" | "low" — how well it suits the applicant's STAGE
       and capacity, INDEPENDENT of eligibility.
  Judge strategicFit by ONE consistent rule for every opportunity. In particular, RESEARCH/
  INSTITUTIONAL mechanisms (R01, R21, RM1, P/U/K/T/F series) require a Principal Investigator
  with academic research credentials and research infrastructure, and reviewers assess
  scientific rigor rather than commercial potential — so for a COMMERCIAL early-stage startup
  they are "low" strategic fit. Apply this to ALL such mechanisms identically (do not rate
  one R01 differently from an RM1). SBIR/STTR are built for companies → fit driven by topic.
  (The application also caps research-mechanism fit to "low" for a small business in code.)
- strategicFit NEVER changes eligibilityStatus and vice-versa. An eligible research grant with
  low fit is still "eligible" — present it as "Eligible to lead · low strategic fit", not as
  ineligible. Do NOT downgrade eligibility because fit is low, and do NOT inflate fit because
  eligibility passes.
- DOMAIN MATCH is part of strategicFit, applied UNIFORMLY to EVERY sector and agency. When the
  applicant's domain is CLEARLY OUTSIDE the funding agency's core mission, set "strategicFit":
  "low" — NEVER "moderate" or "high" — and set "outsideAgencyMission": true. The topic gap, not
  eligibility, is the main barrier. This is symmetric across sectors: NIH's mission is
  health/biomedical, so a water-infrastructure, aerospace, cybersecurity, OR agriculture
  applicant is a domain mismatch with NIH → "low", UNLESS you can articulate a GENUINE
  health/biomedical angle for THIS applicant. SANITY CHECK you must obey: an NIH opportunity may
  be "high" ONLY if the applicant's domain genuinely intersects health/biomedical — water leak
  detection, launch systems, or network security do not, so they are "low" for NIH. If your
  summary gives no in-domain reason for the fit, the badge CANNOT be "high"/"moderate" — it must
  be "low". Your "summary" and every prose field MUST agree with the badge. If the domain
  genuinely overlaps the agency's mission, leave "outsideAgencyMission": false.
  (The application also enforces this deterministically in code as a backstop.)
- Do NOT soften a hard eligibility failure into a surmountable step (never "may require an
  academic collaborator"). If eligibilityStatus is not "eligible", say plainly in
  "whyItMayNotMatch" what the barrier is.
- You MAY OMIT an opportunity from "matches" entirely if it is clearly off-domain noise.
- Do NOT speculate which specific NIH Institute/Center (IC) will fund an opportunity from
  memory. Use TOPIC-LEVEL phrasing instead, e.g. "topic alignment with health informatics
  and clinical technology." Only name an agency if it is the actual agency the API returned
  (given in each opportunity's "agency"), and categorize it correctly: NLM, NCI, NIBIB are
  NIH ICs; AHRQ, FDA, CDC are SEPARATE HHS agencies — NEVER call AHRQ (or FDA/CDC) an NIH
  Institute/Center. Do NOT invent success rates, award figures, or due dates.
- PLAIN TEXT ONLY in every string. NEVER use Markdown syntax — no links like
  "[text](url)", no "**bold**", no backticks, no bullets. The UI renders your text verbatim.
- "summary" is PROSE ONLY, NO numbers/counts (the application computes all counts). When the
  founder is a COMMERCIAL startup and research mechanisms (R01, RM1) appear, state the
  practical barrier PLAINLY and up front (not as a trailing aside): these mechanisms typically
  require a PI with academic research credentials and research infrastructure, and reviewers
  judge scientific rigor rather than commercial potential — so they are a SECONDARY avenue
  only for founders who genuinely have that research capacity. Keep SBIR/STTR as the clear
  PRIMARY route. Do not overstate R01 accessibility.
- "whyItMatches" / "whyItMayNotMatch" must be grounded in the provided opportunity text.

"id" MUST equal the opportunity's opportunityNumber.

Respond with ONLY this JSON (no prose, no code fences):
{
  "honestNoMatch": boolean,
  "summary": string,
  "matches": [
    {
      "id": string,
      "strategicFit": "high"|"moderate"|"low",
      "outsideAgencyMission": boolean,
      "whyItMatches": [ { "dimension": string, "status": "✓"|"~"|"✗", "detail": string } ],
      "whyItMayNotMatch": [ { "detail": string } ],
      "possibleBlockers": [ { "detail": string } ],
      "whatToVerify": [ { "detail": string } ],
      "nextSteps": [ { "detail": string } ]
    }
  ]
}
Order best-fit first. BE CONCISE: keep "whyItMatches" to 3-4 items and every other list to
2-3 items, each "detail" one short sentence.`;

  const runMatch = async (opps: Opportunity[]) => {
    // Give Claude context + the code-computed eligibility (for prose only).
    const forClaude = opps.map((o) => ({
      opportunityNumber: o.opportunityNumber,
      title: o.title,
      agency: o.agency,
      description: clip(o.description, 700),
      eligibility: clip(o.eligibility, 500),
      applicantTypes: o.applicantTypes ?? [],
      eligibilityStatus: eligById.get(o.opportunityNumber)?.status,
    }));

    const raw = await claudeJson<{
      honestNoMatch?: boolean;
      summary?: string;
      matches?: Array<
        Partial<OpportunityMatch> & {
          id: string;
          strategicFit: StrategicFit;
          outsideAgencyMission?: boolean;
        }
      >;
    }>({
      system,
      user: JSON.stringify({ entityType, profile, opportunities: forClaude, evidence }),
      maxTokens: 7000,
      temperature: 0.2,
    });

    // Claude's FIT prose + CODE's eligibility/facts. buildMatches discards any
    // award/deadline/url an LLM tried to include and drops unknown ids.
    const reviewedIds = new Set(reviewedById.keys());
    const built = buildMatches(raw?.matches, reviewedIds, eligById);

    // CODE cap: a research/institutional mechanism is "low" strategic fit for a
    // small business — applied consistently to ALL such mechanisms (fixes the
    // R01-vs-BTOD inconsistency). Does NOT touch eligibility.
    const mechById = new Map<string, MechanismClass>(
      reviewed.map((o) => [o.opportunityNumber, mechanismClass(o)])
    );
    const capped = applyStrategicFitCap(built, mechById, entityType);

    // CODE cap (mission vs domain): strategic fit is forced to "low" when the
    // funding agency's core mission clearly doesn't match the applicant's domain,
    // so the badge can never contradict a summary that gives no in-domain reason.
    // This is enforced DETERMINISTICALLY and UNIFORMLY for every sector by code
    // (an NIH opportunity for a water/aerospace/cyber/ag applicant with no health
    // signal is capped identically) and UNIONED with any opportunity Claude also
    // flagged. Does NOT touch eligibility.
    const applicantText = applicantDomainText(profile);
    const outsideMissionIds = new Set<string>();
    for (const o of reviewed) {
      if (missionDomainMismatch(o.agency, applicantText).mismatch) {
        outsideMissionIds.add(o.opportunityNumber);
      }
    }
    for (const m of Array.isArray(raw?.matches) ? raw.matches : []) {
      if (m?.outsideAgencyMission === true && typeof m?.id === "string") {
        outsideMissionIds.add(m.id);
      }
    }
    const domainCapped = applyDomainMismatchCap(
      capped,
      outsideMissionIds,
      domainMismatchPhrase(language)
    );

    // Put a plain, non-softened eligibility statement first in whyItMayNotMatch
    // for anything the founder can't straightforwardly lead. Axes stay separate.
    const matches = annotateEligibility(domainCapped, eligibilityPhrases(language, entityType));
    const counts = computeCounts(reviewed.length, matches);
    const summary = stripNumbers(typeof raw?.summary === "string" ? raw.summary : "");

    return {
      matches,
      counts,
      honestNoMatch: Boolean(raw?.honestNoMatch),
      summary,
    } satisfies MatchResult;
  };

  try {
    return NextResponse.json(await runMatch(reviewed));
  } catch (err) {
    console.error("[/api/match] first attempt failed, retrying smaller:", err);
    try {
      return NextResponse.json(await runMatch(reviewed.slice(0, 4)));
    } catch (err2) {
      console.error("[/api/match] error:", err2);
      return NextResponse.json(
        { error: "Matching failed. Please try again." },
        { status: 500 }
      );
    }
  }
}

/* --------------------------------- helpers -------------------------------- */

/** Plain, non-softened eligibility statements (code-owned, localized, entity-aware). */
function eligibilityPhrases(
  language: Language,
  entityType: EntityType
): { ineligible: string; premature: string; verify: string } {
  const pointerEn =
    entityType === "small_business"
      ? " The SBIR/STTR pathway is the route a company like yours can lead."
      : " Look for opportunities whose declared applicants include your organization type.";
  const pointerEs =
    entityType === "small_business"
      ? " La vía SBIR/STTR es la que una empresa como la tuya sí puede liderar."
      : " Busca oportunidades cuyos solicitantes elegibles incluyan tu tipo de organización.";

  if (language === "es") {
    return {
      ineligible:
        "Según los solicitantes elegibles declarados en este FOA, tu tipo de organización NO está entre quienes pueden liderar esta solicitud." +
        pointerEs,
      premature:
        "Requiere una adjudicación Fase II previa de SBIR/STTR que tu perfil no indica que tengas — primero busca Fase I/II. Esto es un prerrequisito conocido, no algo que verificar con la agencia.",
      verify:
        "Este FOA no indica claramente los tipos de solicitante elegibles. Confirma en el anuncio oficial si tu tipo de organización puede LIDERAR antes de invertir tiempo — no asumas que está abierto.",
    };
  }
  return {
    ineligible:
      "Based on this FOA's declared eligible applicants, your organization type is NOT among those eligible to LEAD this application." +
      pointerEn,
    premature:
      "Requires a prior SBIR/STTR Phase II award, which your profile indicates you don't have — pursue Phase I/II first. This is a known prerequisite, not something to verify with the agency.",
    verify:
      "This FOA does not clearly list eligible applicant types. Confirm on the official listing whether your organization type may LEAD before investing time — do not assume it is open.",
  };
}

/** Code-owned, localized reason for a domain/mission mismatch (topic gap). */
function domainMismatchPhrase(language: Language): string {
  return language === "es"
    ? "Fuera del dominio central de la misión de esta agencia; la alineación temática es la principal barrera."
    : "Outside this agency's core mission domain; topic alignment is the main barrier.";
}

function clip(text: string | null, max: number): string | null {
  if (!text) return text;
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}
