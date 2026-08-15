import { NextRequest, NextResponse } from "next/server";
import { claudeJson, languageName } from "@/lib/anthropic";
import { OFFICIAL_LINKS } from "@/lib/officialLinks";
import {
  fetchOpportunityDetail,
  type OpportunityDetail,
} from "@/lib/grantsgov";
import { detectPriorPhaseII } from "@/lib/eligibility";
import type {
  BaseRegistrationStep,
  DynamicPlan,
  DynamicStep,
  EligibilityGateItem,
  Language,
  Opportunity,
  PlanDraft,
  PrefillField,
  RequiredForm,
  StepSource,
  SubmissionSystem,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/application-plan — generates a DYNAMIC plan tailored to THIS opportunity.
 *
 * Principle: Claude EXPLAINS; the official FOA metadata DETERMINES. Every step
 * is traceable to (a) the fetchOpportunity response or (b) the fixed base-
 * registration constants. Anything else becomes a "verify-official" step with a
 * real link — never an invented requirement.
 *
 * Ownership split:
 *  - CODE owns baseRegistrations (fixed times + OFFICIAL_LINKS) and ALL URLs.
 *  - Claude fills only the FOA-derived dynamic parts (submission system, steps,
 *    forms, eligibility gate, drafts, prefill), and every URL it emits is
 *    sanitized against an allowlist built from official data.
 *
 * The wizard always renders: even if fetchOpportunity AND Claude both fail, we
 * return baseRegistrations + a single "verify on the official portal" step.
 */
export async function POST(req: NextRequest) {
  let opportunity: Opportunity;
  let profile: Record<string, unknown>;
  let language: Language = "en";

  try {
    const body = await req.json();
    opportunity = body.opportunity;
    profile = body.profile ?? {};
    language = body.language === "es" ? "es" : "en";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!opportunity?.opportunityNumber) {
    return NextResponse.json({ error: "Missing opportunity." }, { status: 400 });
  }

  const baseRegistrations = buildBaseRegistrations(language);
  const sourceUrl = opportunity.sourceUrl ?? null;
  const internalId = resolveInternalId(opportunity);

  // CHANGE 1 — fetch THIS opportunity's real detail (graceful on failure).
  let detail: OpportunityDetail | null = null;
  if (internalId) {
    detail = await fetchOpportunityDetail(internalId);
  }

  // Allowlist of URLs Claude is permitted to reference (official sources only).
  const allowedUrls = buildAllowedUrls(opportunity, detail);

  // If we have essentially no FOA detail, degrade to base + a verify step, but
  // still ask Claude for drafts/eligibility using whatever text we already have.
  const detailAvailable = Boolean(
    detail && (detail.description || detail.eligibility || detail.requiredForms.length)
  );

  try {
    const dynamic = await generateDynamicParts({
      language,
      opportunity,
      profile,
      detail,
      detailAvailable,
    });

    const plan: DynamicPlan = {
      opportunityId: opportunity.opportunityNumber,
      submissionSystem: sanitizeSubmissionSystem(
        dynamic.submissionSystem,
        opportunity,
        detail,
        allowedUrls
      ),
      baseRegistrations,
      dynamicSteps: sanitizeSteps(dynamic.dynamicSteps, sourceUrl, allowedUrls, language),
      requiredForms: normalizeForms(dynamic.requiredForms),
      eligibilityGate: withPhaseIIGate(
        normalizeGate(dynamic.eligibilityGate),
        opportunity,
        language
      ),
      drafts: normalizeDrafts(dynamic.drafts),
      prefillData: { fields: normalizeFields(dynamic.prefillData?.fields) },
      degraded: !detailAvailable,
    };

    // Guarantee at least one dynamic step so the wizard is always actionable.
    if (plan.dynamicSteps.length === 0) {
      plan.dynamicSteps = [verifyStep(sourceUrl, language)];
    }

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("[/api/application-plan] error (falling back):", err);
    // Hard fallback — the wizard must never be left broken.
    const plan: DynamicPlan = {
      opportunityId: opportunity.opportunityNumber,
      submissionSystem: defaultSubmissionSystem(opportunity, detail, language),
      baseRegistrations,
      dynamicSteps: [verifyStep(sourceUrl, language)],
      requiredForms: [{ formName: "", source: "verify-official" }],
      eligibilityGate: [],
      drafts: [],
      prefillData: { fields: [] },
      degraded: true,
    };
    return NextResponse.json({ plan });
  }
}

/* -------------------------- Claude: dynamic parts -------------------------- */

interface DynamicParts {
  submissionSystem: SubmissionSystem;
  dynamicSteps: DynamicStep[];
  requiredForms: RequiredForm[];
  eligibilityGate: EligibilityGateItem[];
  drafts: PlanDraft[];
  prefillData: { fields: PrefillField[] };
}

async function generateDynamicParts(args: {
  language: Language;
  opportunity: Opportunity;
  profile: Record<string, unknown>;
  detail: OpportunityDetail | null;
  detailAvailable: boolean;
}): Promise<DynamicParts> {
  const { language, opportunity, profile, detail, detailAvailable } = args;

  const system = `You are GovMatch's application coach. You EXPLAIN in plain language; the
official FOA (funding opportunity announcement) metadata DETERMINES every fact. Write ALL
human-readable text in ${languageName(language)}. The founder is NOT technical.

You are given ONE opportunity's official detail (from Grants.gov fetchOpportunity) plus the
founder's profile. Build the DYNAMIC part of an application plan tailored to THIS
opportunity. Do NOT use a fixed template — include a step ONLY when this FOA actually
supports it.

HARD RULES:
- KEEP IT SHORT: at most 3-5 dynamicSteps total. Include the genuinely distinct ones
  (e.g. Letter of Intent, cost-sharing, submission system) and MERGE what would otherwise be
  several repetitive "verify on the portal" steps into a single one. Do not pad the list.
- Never invent a requirement, a form, a deadline, a dollar amount, or a URL. If the detail
  doesn't state something, either omit it or express it as a "verify-official" step.
- Every dynamicStep MUST have "source": "FOA" (grounded in the provided detail) or
  "verify-official" (the founder must confirm it on the official portal). When unsure, use
  "verify-official".
- Every CONDITIONAL step MUST include "conditionReason" naming the evidence in THIS FOA
  (e.g. "FOA declares a Letter of Intent due <date>", "Synopsis requires cost-sharing").
  Unconditional steps may use an empty conditionReason.
- Conditional blocks to include ONLY when the detail supports them:
    • submissionSystem: infer from the agency and related links. If submission is via
      Grants.gov, say so. If the FOA points elsewhere (e.g. NSF Research.gov, NIH
      ASSIST/Workspace), add a step reflecting ONLY what the FOA/related links say — never
      hardcode an agency's internal flow.
    • Letter of Intent / pre-application: ONLY if the detail declares one (with its date).
    • Cost-sharing / matching: ONLY if the detail mentions it → add a step + an eligibility
      question.
    • requiredForms: list the ACTUAL forms from the detail. If forms are missing, return a
      single form with source "verify-official".
- eligibilityGate: generate from the FOA's declared eligible applicant types and any hard
  requirements — NOT a generic list. "ifFailImpact" says what happens if the founder can't
  meet it.
- drafts: 1-4 real narrative drafts (actual prose the founder can edit), grounded in the
  opportunity and the profile.
- prefillData.fields: concrete values reusable across forms, derived from the profile. Mark
  "sensitive": true for legal name, EIN, UEI, bank, SSN, personal address. If a real value
  is unknown, use a clear placeholder like "[Your company's EIN]" and still mark sensitive.
- Do NOT include the base registrations (Login.gov, SAM.gov, Grants.gov) — those are added
  separately by the app.
- For any officialLink, use ONLY a URL that appears in the provided detail (its
  additionalInformationUrl or relatedLinks) or the opportunity's sourceUrl. If you have no
  such URL, use "" (empty). The app validates every URL you return.
${
  detailAvailable
    ? ""
    : `- NOTE: full FOA detail could not be read automatically. Rely on the opportunity's
  description/eligibility text if present, and prefer "verify-official" steps.`
}

Respond with ONLY this JSON (no prose, no code fences):
{
  "submissionSystem": { "name": string, "officialUrl": string, "note": string },
  "dynamicSteps": [
    { "stepType": string, "title": string, "whatItIs": string,
      "source": "FOA" | "verify-official", "officialLink": string,
      "activeTime": string, "waitTime": string|null, "warning": string,
      "conditionReason": string }
  ],
  "requiredForms": [ { "formName": string, "source": "Package" | "verify-official" } ],
  "eligibilityGate": [ { "question": string, "ifFailImpact": string } ],
  "drafts": [ { "sectionName": string, "draft": string${
    language === "es" ? ', "english": string' : ""
  } } ],
  "prefillData": { "fields": [ { "key": string, "value": string, "sensitive": boolean } ] }
}`;

  const user = JSON.stringify({
    opportunity: {
      opportunityNumber: opportunity.opportunityNumber,
      title: opportunity.title,
      agency: opportunity.agency,
      description: opportunity.description,
      eligibility: opportunity.eligibility,
      deadline: opportunity.deadline,
      awardFloor: opportunity.awardFloor,
      awardCeiling: opportunity.awardCeiling,
      sourceUrl: opportunity.sourceUrl,
    },
    foaDetail: detail,
    profile,
  });

  const parts = await claudeJson<DynamicParts>({
    system,
    user,
    maxTokens: 8000,
    temperature: 0.3,
  });
  return parts;
}

/* --------------------------- Fixed base registrations ---------------------- */

function buildBaseRegistrations(lang: Language): BaseRegistrationStep[] {
  if (lang === "es") {
    return [
      {
        task: "Crea una cuenta en Login.gov (verificación de identidad)",
        whatItIs:
          "Login.gov es el inicio de sesión único y seguro del gobierno de EE. UU. Verificas tu identidad una vez y la reutilizas en los sistemas federales.",
        officialLink: OFFICIAL_LINKS.loginGov,
        activeTime: "15-30 min",
        waitTime: "Normalmente inmediato (más largo si la verificación automática falla)",
        warning: null,
      },
      {
        task: "Registra tu entidad en SAM.gov (obtén tu UEI)",
        whatItIs:
          "El registro en SAM.gov le da a tu empresa un Identificador Único de Entidad (UEI) y es OBLIGATORIO para recibir cualquier subvención federal.",
        officialLink: OFFICIAL_LINKS.samGov,
        activeTime: "1-3 horas",
        waitTime: "10-15 días hábiles (3-4 semanas si hay errores)",
        warning:
          "Empieza HOY — tarda semanas. La causa n.º 1 de rechazo es un nombre legal y una dirección que no coinciden EXACTAMENTE con los registros del IRS. El UEI se asigna en minutos si los datos coinciden.",
      },
      {
        task: "Configura tu rol en Grants.gov (EBiz POC / AOR)",
        whatItIs:
          "Grants.gov es donde enviarás la solicitud. El Punto de Contacto de Negocios Electrónicos (EBiz POC) de tu organización te autoriza como Representante Autorizado de la Organización (AOR) para poder aplicar.",
        officialLink: OFFICIAL_LINKS.grantsGov,
        activeTime: "30 min",
        waitTime: "Depende de que SAM.gov esté activo primero",
        warning: null,
      },
    ];
  }
  return [
    {
      task: "Create a Login.gov account (identity verification)",
      whatItIs:
        "Login.gov is the U.S. government's single secure sign-in. You verify your identity once and reuse it across federal systems.",
      officialLink: OFFICIAL_LINKS.loginGov,
      activeTime: "15-30 min",
      waitTime: "Usually immediate (longer if automated verification fails)",
      warning: null,
    },
    {
      task: "Register your entity in SAM.gov (get your UEI)",
      whatItIs:
        "SAM.gov registration gives your business a Unique Entity ID (UEI) and is MANDATORY to receive any federal grant.",
      officialLink: OFFICIAL_LINKS.samGov,
      activeTime: "1-3 hours",
      waitTime: "10-15 business days (3-4 weeks if there are errors)",
      warning:
        "Start TODAY — it takes weeks. The #1 cause of rejection is a legal name and address that don't EXACTLY match IRS records. The UEI is assigned within minutes if the data matches.",
    },
    {
      task: "Set up your Grants.gov role (EBiz POC / AOR)",
      whatItIs:
        "Grants.gov is where you'll submit. Your organization's E-Business Point of Contact authorizes you as an Authorized Organization Representative (AOR) so you can apply.",
      officialLink: OFFICIAL_LINKS.grantsGov,
      activeTime: "30 min",
      waitTime: "Depends on SAM.gov being active first",
      warning: null,
    },
  ];
}

/* ------------------------------- Sanitizers -------------------------------- */

function resolveInternalId(opp: Opportunity): string | null {
  if (opp.internalId && /^\d+$/.test(opp.internalId)) return opp.internalId;
  // Fallback: extract from the canonical Grants.gov detail URL.
  const m = opp.sourceUrl && /search-results-detail\/(\d+)/.exec(opp.sourceUrl);
  return m ? m[1] : null;
}

function buildAllowedUrls(
  opp: Opportunity,
  detail: OpportunityDetail | null
): Set<string> {
  const set = new Set<string>();
  if (opp.sourceUrl) set.add(opp.sourceUrl);
  set.add(OFFICIAL_LINKS.loginGov);
  set.add(OFFICIAL_LINKS.samGov);
  set.add(OFFICIAL_LINKS.grantsGov);
  if (detail?.additionalInformationUrl) set.add(detail.additionalInformationUrl);
  for (const l of detail?.relatedLinks ?? []) set.add(l.url);
  return set;
}

/** Return the URL only if it is an official/allowed URL, else null. */
function safeUrl(url: unknown, allowed: Set<string>): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const u = url.trim();
  if (allowed.has(u)) return u;
  // allow a related link that shares an allowed origin path prefix
  for (const a of allowed) {
    if (u === a) return u;
  }
  return null;
}

// Keep the wizard from overwhelming the founder: cap the dynamic steps and
// consolidate repetitive "verify on the portal" items into a few.
const MAX_DYNAMIC_STEPS = 5;

function sanitizeSteps(
  steps: unknown,
  sourceUrl: string | null,
  allowed: Set<string>,
  lang: Language
): DynamicStep[] {
  if (!Array.isArray(steps)) return [];
  const built = steps
    .filter((s) => s && typeof s === "object")
    .map((raw) => {
      const s = raw as Partial<DynamicStep>;
      const source: StepSource = s.source === "FOA" ? "FOA" : "verify-official";
      let link = safeUrl(s.officialLink, allowed);
      // A verify-official step should always point somewhere official.
      if (!link && source === "verify-official") link = sourceUrl;
      return {
        stepType: str(s.stepType) || "step",
        title: str(s.title),
        whatItIs: str(s.whatItIs),
        source,
        officialLink: link,
        activeTime: s.activeTime != null ? str(s.activeTime) : null,
        waitTime: s.waitTime != null && s.waitTime !== "" ? str(s.waitTime) : null,
        warning: s.warning != null && s.warning !== "" ? str(s.warning) : null,
        conditionReason: str(s.conditionReason),
      };
    })
    .filter((s) => s.title || s.whatItIs);

  // FOA-grounded steps are the specific, useful ones — keep them first. Then add
  // de-duplicated verify-official steps, and cap the total so the wizard stays short.
  const seen = new Set<string>();
  const dedup = (arr: DynamicStep[]) =>
    arr.filter((s) => {
      const k = s.title.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const foa = dedup(built.filter((s) => s.source === "FOA"));
  const verify = dedup(built.filter((s) => s.source === "verify-official"));
  return [...foa, ...verify].slice(0, MAX_DYNAMIC_STEPS);
}

function sanitizeSubmissionSystem(
  sys: unknown,
  opp: Opportunity,
  detail: OpportunityDetail | null,
  allowed: Set<string>
): SubmissionSystem {
  const s = (sys && typeof sys === "object" ? sys : {}) as Partial<SubmissionSystem>;
  const url = safeUrl(s.officialUrl, allowed) ?? opp.sourceUrl ?? OFFICIAL_LINKS.grantsGov;
  return {
    name: str(s.name) || (detail?.agencyName ? `${detail.agencyName} (via Grants.gov)` : "Grants.gov"),
    officialUrl: url,
    note: str(s.note),
  };
}

function defaultSubmissionSystem(
  opp: Opportunity,
  detail: OpportunityDetail | null,
  lang: Language
): SubmissionSystem {
  return {
    name: detail?.agencyName ? `${detail.agencyName} (Grants.gov)` : "Grants.gov",
    officialUrl: opp.sourceUrl ?? OFFICIAL_LINKS.grantsGov,
    note:
      lang === "es"
        ? "Confirma el sistema de envío en el portal oficial de esta oportunidad."
        : "Confirm the submission system on this opportunity's official portal.",
  };
}

function verifyStep(sourceUrl: string | null, lang: Language): DynamicStep {
  return lang === "es"
    ? {
        stepType: "verify-requirements",
        title: "Confirma los requisitos específicos de esta oportunidad",
        whatItIs:
          "El proceso de cada agencia es diferente. Abre el anuncio oficial de esta oportunidad y confirma los formularios requeridos, las fechas límite y cualquier regla de carta de intención o de fondos de contrapartida antes de invertir tiempo.",
        source: "verify-official",
        officialLink: sourceUrl,
        activeTime: "30-60 min",
        waitTime: null,
        warning: null,
        conditionReason:
          "No pudimos leer automáticamente el detalle completo de este anuncio: confírmalo en el portal oficial.",
      }
    : {
        stepType: "verify-requirements",
        title: "Confirm this opportunity's specific requirements",
        whatItIs:
          "Every agency's process differs. Open this opportunity's official listing and confirm the required forms, deadlines, and any letter-of-intent or cost-sharing rules before you invest time.",
        source: "verify-official",
        officialLink: sourceUrl,
        activeTime: "30-60 min",
        waitTime: null,
        warning: null,
        conditionReason:
          "We couldn't automatically read this FOA's full detail — confirm on the official portal.",
      };
}

function normalizeForms(forms: unknown): RequiredForm[] {
  if (!Array.isArray(forms)) return [{ formName: "", source: "verify-official" }];
  const out = forms
    .filter((f) => f && typeof f === "object")
    .map((raw) => {
      const f = raw as Partial<RequiredForm>;
      return {
        formName: str(f.formName),
        source: f.source === "Package" ? ("Package" as const) : ("verify-official" as const),
      };
    });
  return out.length ? out : [{ formName: "", source: "verify-official" }];
}

function normalizeGate(gate: unknown): EligibilityGateItem[] {
  if (!Array.isArray(gate)) return [];
  return gate
    .filter((g) => g && typeof g === "object")
    .map((raw) => {
      const g = raw as Partial<EligibilityGateItem>;
      return { question: str(g.question), ifFailImpact: str(g.ifFailImpact) };
    })
    .filter((g) => g.question);
}

/**
 * When THIS opportunity declares a prior-Phase-II prerequisite (Phase IIB /
 * Bridge), prepend the concrete gate question so the founder answers it early.
 */
function withPhaseIIGate(
  gate: EligibilityGateItem[],
  opportunity: Opportunity,
  language: Language
): EligibilityGateItem[] {
  if (!detectPriorPhaseII(opportunity)) return gate;
  const q: EligibilityGateItem =
    language === "es"
      ? {
          question: "¿Tienes una adjudicación Fase II previa de SBIR/STTR?",
          ifFailImpact:
            "Si NO: esta oportunidad (Phase IIB / Bridge) es prematura para ti — primero necesitas una Fase II. Busca la ruta Fase I/II.",
        }
      : {
          question: "Do you have a prior SBIR/STTR Phase II award?",
          ifFailImpact:
            "If NO: this Phase IIB / Bridge opportunity is premature for you — you need a prior Phase II first. Pursue the Phase I/II route.",
        };
  // Avoid duplicating if Claude already asked something equivalent.
  if (gate.some((g) => /phase\s*ii/i.test(g.question))) return gate;
  return [q, ...gate];
}

function normalizeDrafts(drafts: unknown): PlanDraft[] {
  if (!Array.isArray(drafts)) return [];
  return drafts
    .filter((d) => d && typeof d === "object")
    .map((raw) => {
      const d = raw as Partial<PlanDraft>;
      return {
        sectionName: str(d.sectionName),
        draft: str(d.draft),
        english: typeof d.english === "string" ? d.english : undefined,
      };
    })
    .filter((d) => d.sectionName || d.draft);
}

function normalizeFields(fields: unknown): PrefillField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f === "object")
    .map((raw) => {
      const f = raw as Partial<PrefillField>;
      return {
        key: str(f.key),
        value: str(f.value),
        sensitive: Boolean(f.sensitive),
      };
    })
    .filter((f) => f.key);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
