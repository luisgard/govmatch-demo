import { fetchWithTimeout } from "./http";
import { deriveActivityCode } from "./eligibility";
import type { Opportunity } from "./types";

/**
 * Grants.gov API client.
 *
 * search2  -> lightweight opportunity hits (title, agency, dates, status)
 * fetchOpportunity -> full synopsis (award ceiling/floor, description, eligibility)
 *
 * Every field on the returned Opportunity comes ONLY from these API responses.
 * Nothing is invented; unknown fields are null.
 */

const SEARCH_URL = "https://api.grants.gov/v1/api/search2";
const FETCH_URL = "https://api.grants.gov/v1/api/fetchOpportunity";

const REQUEST_TIMEOUT = 15000;
const RETRY_ATTEMPTS = 3; // total tries per request (government APIs can be flaky)

/**
 * POST JSON to a Grants.gov endpoint with a hard timeout and retries.
 * Retries on network failure, timeout, or 5xx. Returns parsed JSON or null.
 * This is the fix for the "null description" problem: a single slow/timed-out
 * fetchOpportunity used to leave an opportunity un-enriched.
 */
async function postJsonRetry<T>(url: string, body: unknown): Promise<T | null> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT
      );
      if (res.ok) {
        return (await res.json()) as T;
      }
      // Retry server errors and rate-limits; give up on other 4xx.
      if (res.status !== 429 && res.status < 500) return null;
    } catch (err) {
      if (attempt === RETRY_ATTEMPTS) {
        console.error(`[grantsgov] ${url} failed after ${attempt} attempts:`, err);
      }
    }
    // Backoff before the next attempt (0.4s, 0.8s, ...).
    if (attempt < RETRY_ATTEMPTS) {
      await sleep(400 * attempt);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OppHit {
  id?: string | number;
  number?: string;
  title?: string;
  agencyCode?: string;
  agency?: string;
  agencyName?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
}

/** Raw search2 hit, kept before enrichment. */
export interface RawOpportunity {
  internalId: string | null;
  opportunityNumber: string;
  title: string;
  agency: string | null;
  closeDate: string | null;
  oppStatus: string | null;
}

/** Run one search2 query for a keyword. Returns [] on any failure. */
export async function searchKeyword(keyword: string): Promise<RawOpportunity[]> {
  const json = await postJsonRetry<{ data?: { oppHits?: OppHit[] } }>(SEARCH_URL, {
    keyword,
    oppStatuses: "posted|forecasted",
    rows: 25,
  });
  const hits: OppHit[] = json?.data?.oppHits ?? [];
  if (!Array.isArray(hits)) return [];
  return hits.map(normalizeHit).filter((h): h is RawOpportunity => h !== null);
}

function normalizeHit(hit: OppHit): RawOpportunity | null {
  const opportunityNumber = (hit.number ?? "").trim();
  const title = (hit.title ?? "").trim();
  const agency = (hit.agencyName ?? hit.agency ?? "").trim() || null;
  // Quality filter (part of it): drop hits with no usable identity.
  if (!opportunityNumber || !title || !agency) return null;
  return {
    internalId: hit.id != null ? String(hit.id) : null,
    opportunityNumber,
    title,
    agency,
    closeDate: hit.closeDate?.trim() || null,
    oppStatus: hit.oppStatus?.trim() || null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FetchResponse {
  data?: any;
}

/**
 * Grants.gov detail lives under `synopsis` for POSTED opportunities and under
 * `forecast` for FORECASTED ones, with slightly different field names. Read both
 * so forecasted opportunities (many NIH/SBIR notices) aren't left description-less.
 */
function pickDetail(data: any): {
  description: string | null;
  eligibility: string | null;
  deadline: string | null;
  awardCeiling: number | null;
  awardFloor: number | null;
  agencyName: string | null;
  additionalInformationUrl: string | null;
  fundingType: string | null;
  raw: any;
} {
  const syn = data?.synopsis;
  const fc = data?.forecast;
  const d = syn ?? fc ?? {};
  return {
    description: cleanText(d.synopsisDesc ?? d.forecastDesc ?? d.description),
    eligibility: cleanText(d.applicantEligibilityDesc),
    fundingType: extractFundingType(d),
    // POSTED uses responseDate; FORECAST uses estApplicationResponseDate (fall
    // back to the estimated synopsis-posting date). Field names differ.
    deadline:
      (d.responseDate?.trim?.() ||
        d.estApplicationResponseDate?.trim?.() ||
        d.estSynopsisPostingDate?.trim?.() ||
        null) ??
      null,
    // FORECAST has no per-award ceiling/floor (only program-total
    // estimatedFunding), so those stay null — never misrepresented.
    awardCeiling: toNumber(d.awardCeiling),
    awardFloor: toNumber(d.awardFloor),
    agencyName:
      d.agencyName?.trim?.() ||
      d.agencyDetails?.agencyName?.trim?.() ||
      data?.agencyName?.trim?.() ||
      data?.agencyDetails?.agencyName?.trim?.() ||
      null,
    additionalInformationUrl:
      typeof d.additionalInformationUrl === "string" &&
      /^https?:\/\//i.test(d.additionalInformationUrl)
        ? d.additionalInformationUrl
        : null,
    raw: d,
  };
}

/** Funding instrument/type from the API (e.g. "Grant"). Null if not provided. */
function extractFundingType(d: any): string | null {
  const arr = d?.fundingInstruments;
  if (Array.isArray(arr) && arr.length) {
    const names = arr
      .map((f: any) => (typeof f === "string" ? f : f?.description ?? null))
      .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0);
    if (names.length) return names.join(", ");
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Enrich one opportunity with its full detail (synopsis OR forecast). On any
 * failure, returns the fields we already have and null for the rest.
 */
export async function enrichOpportunity(raw: RawOpportunity): Promise<Opportunity> {
  const base: Opportunity = {
    opportunityNumber: raw.opportunityNumber,
    title: raw.title,
    agency: raw.agency,
    description: null,
    eligibility: null,
    deadline: raw.closeDate,
    awardCeiling: null,
    awardFloor: null,
    sourceUrl: buildSourceUrl(raw.internalId, null),
    internalId: raw.internalId,
    status: raw.oppStatus,
    fundingType: null,
    source: "Grants.gov",
    applicantTypes: [],
    activityCode: deriveActivityCode(raw.title, raw.opportunityNumber),
  };

  if (!raw.internalId) return base;

  const json = await postJsonRetry<FetchResponse>(FETCH_URL, {
    opportunityId: Number(raw.internalId),
  });
  if (!json?.data) return base;
  const d = pickDetail(json.data);

  return {
    ...base,
    description: d.description ?? base.description,
    eligibility: d.eligibility ?? base.eligibility,
    deadline: d.deadline ?? base.deadline,
    awardCeiling: d.awardCeiling,
    awardFloor: d.awardFloor,
    agency: d.agencyName ?? base.agency,
    sourceUrl: buildSourceUrl(raw.internalId, d.additionalInformationUrl),
    fundingType: d.fundingType,
    applicantTypes: extractApplicantTypes(d.raw),
  };
}

/** Does an enriched opportunity have enough detail for Claude to evaluate it? */
export function hasUsableDetail(o: Opportunity): boolean {
  const desc = (o.description ?? "").trim();
  const elig = (o.eligibility ?? "").trim();
  return desc.length >= 40 || elig.length >= 40;
}

/**
 * Curated FOA detail for the application-plan route. Every field is best-effort:
 * whatever the fetchOpportunity response actually contains. Absent fields stay
 * empty/null — never invented.
 */
export interface OpportunityDetail {
  internalId: string;
  opportunityNumber: string | null;
  title: string | null;
  agencyName: string | null;
  description: string | null;
  eligibility: string | null;
  applicantTypes: string[];
  awardCeiling: number | null;
  awardFloor: number | null;
  deadline: string | null;
  costSharing: string | null;
  agencyContact: string | null;
  additionalInformationUrl: string | null;
  requiredForms: string[];
  relatedLinks: { label: string | null; url: string }[];
}

/**
 * Fetch the SPECIFIC opportunity's full detail (synopsis + packages/forms +
 * related links) so the plan can be tailored to what THIS FOA declares.
 * Returns null on any failure/timeout — the caller then falls back gracefully.
 */
export async function fetchOpportunityDetail(
  internalId: string
): Promise<OpportunityDetail | null> {
  if (!internalId || !/^\d+$/.test(internalId)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await postJsonRetry<any>(FETCH_URL, {
      opportunityId: Number(internalId),
    });
    const data = json?.data;
    if (!data) return null;
    // Posted opportunities use `synopsis`; forecasted ones use `forecast`.
    const syn = data.synopsis ?? data.forecast ?? {};
    const picked = pickDetail(data);

    return {
      internalId,
      opportunityNumber: data.opportunityNumber ?? null,
      title: data.opportunityTitle ?? null,
      agencyName: picked.agencyName,
      description: picked.description,
      eligibility: picked.eligibility,
      applicantTypes: extractApplicantTypes(syn),
      awardCeiling: picked.awardCeiling,
      awardFloor: picked.awardFloor,
      deadline: picked.deadline,
      costSharing: extractCostSharing(syn),
      agencyContact: cleanText(syn.agencyContactName) ?? syn.agencyContactEmail ?? null,
      additionalInformationUrl: picked.additionalInformationUrl,
      requiredForms: extractForms(data),
      relatedLinks: extractRelatedLinks(data, syn),
    };
  } catch (err) {
    console.error(`[grantsgov] fetchOpportunityDetail(${internalId}) failed:`, err);
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractApplicantTypes(syn: any): string[] {
  const arr = syn?.applicantTypes;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a: any) =>
      typeof a === "string" ? a : a?.description ?? a?.applicantTypeName ?? null
    )
    .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0);
}

function extractCostSharing(syn: any): string | null {
  // costSharing is a boolean on synopsis/forecast; some FOAs also use a Y/N flag.
  const flag = syn?.costSharing ?? syn?.costSharingOrMatchingRequirement;
  if (flag === true || (typeof flag === "string" && /^y(es)?$/i.test(flag.trim()))) {
    return "The listing marks cost-sharing / matching as required.";
  }
  const hay = `${syn?.synopsisDesc ?? ""} ${syn?.forecastDesc ?? ""} ${syn?.applicantEligibilityDesc ?? ""}`;
  if (/cost[\s-]*shar|matching funds?|match requirement/i.test(hay)) {
    return "The synopsis text mentions cost-sharing / matching funds.";
  }
  return null;
}

function extractForms(data: any): string[] {
  const names = new Set<string>();
  // Try several shapes the fetchOpportunity response has used for packages/forms.
  const pkgLists = [
    data?.opportunityPkgs,
    data?.opportunityPackages,
    data?.packages,
    data?.synopsis?.opportunityPkgs,
  ];
  for (const list of pkgLists) {
    if (!Array.isArray(list)) continue;
    for (const pkg of list) {
      const forms =
        pkg?.formsList ?? pkg?.forms ?? pkg?.mandatoryForms ?? pkg?.formList;
      if (Array.isArray(forms)) {
        for (const f of forms) {
          const name =
            typeof f === "string" ? f : f?.formName ?? f?.name ?? f?.form ?? null;
          if (typeof name === "string" && name.trim()) names.add(name.trim());
        }
      }
    }
  }
  return [...names];
}

function extractRelatedLinks(
  data: any,
  syn: any
): { label: string | null; url: string }[] {
  const out: { label: string | null; url: string }[] = [];
  const seen = new Set<string>();
  const push = (url: unknown, label: unknown) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url);
      out.push({ url, label: typeof label === "string" ? label : null });
    }
  };
  if (syn?.additionalInformationUrl)
    push(syn.additionalInformationUrl, syn.additionalInformationText ?? "More information");
  const candidates = [data?.relatedLinks, data?.synopsis?.relatedLinks];
  for (const list of candidates) {
    if (Array.isArray(list)) {
      for (const l of list) push(l?.url ?? l?.href ?? l, l?.label ?? l?.title);
    }
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Build the opportunity's official link from API-provided data ONLY.
 * Preference order:
 *   1. additionalInformationUrl returned by the synopsis (a real API field)
 *   2. The canonical Grants.gov detail page, built deterministically from the
 *      API-returned internal id. This is an official URL derived from official
 *      data, not content invented by the model.
 * Returns null if we have neither.
 */
function buildSourceUrl(internalId: string | null, extra?: string | null): string | null {
  const clean = extra?.trim();
  if (clean && /^https?:\/\//i.test(clean)) return clean;
  if (internalId && /^\d+$/.test(internalId)) {
    return `https://www.grants.gov/search-results-detail/${internalId}`;
  }
  return null;
}

function toNumber(v: string | number | undefined | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Strip HTML tags and collapse whitespace from API description text. */
function cleanText(v: string | undefined | null): string | null {
  if (!v) return null;
  const text = v
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/**
 * Is this opportunity still open? Drops results whose close date is in the past.
 * Part of the quality filter. Forecasted opportunities (no close date) are kept.
 */
export function isStillOpen(deadline: string | null): boolean {
  if (!deadline) return true; // forecasted / not specified — keep it
  const parsed = parseGrantsDate(deadline);
  if (!parsed) return true; // unparseable — don't over-filter
  return parsed.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

function parseGrantsDate(value: string): Date | null {
  const mmddyyyy = /^(\d{2})(\d{2})(\d{4})$/.exec(value.trim());
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
