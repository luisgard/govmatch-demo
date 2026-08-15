import { NextRequest, NextResponse } from "next/server";
import {
  enrichOpportunity,
  hasUsableDetail,
  isStillOpen,
  searchKeyword,
  type RawOpportunity,
} from "@/lib/grantsgov";
import type { Opportunity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_KEYWORDS = 5; // original keywords to search
const MAX_ENRICH = 16; // enrich (fetch synopsis for) up to N candidates
const MAX_RESULTS = 12; // hand at most N opportunities to Claude

/**
 * /api/opportunities — opportunity discovery via Grants.gov.
 *
 * Search by each key keyword PLUS SBIR/STTR-biased queries (the real federal
 * funding path for startups), then apply the QUALITY FILTER in order:
 *   1. Deduplicate by opportunity number
 *   2. Remove obviously irrelevant results (closed/expired, or no title/agency)
 *   3. Normalize + ENRICH (fetchOpportunity, with retries) into a clean shape
 *   4. Prioritize opportunities that actually have a usable description, so
 *      Claude isn't handed a pile of null-detail records to (correctly) reject.
 */
export async function POST(req: NextRequest) {
  let keywords: string[] = [];
  try {
    const body = await req.json();
    keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k: unknown) => typeof k === "string" && k.trim())
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: "No search keywords provided." },
      { status: 400 }
    );
  }

  try {
    const queries = buildQueries(keywords);

    // 1. Search every query.
    const searches = await Promise.all(queries.map((q) => searchKeyword(q)));
    const allHits: RawOpportunity[] = searches.flat();

    // QUALITY FILTER
    // 1) Deduplicate by opportunity number.
    const byNumber = new Map<string, RawOpportunity>();
    for (const hit of allHits) {
      if (!byNumber.has(hit.opportunityNumber)) {
        byNumber.set(hit.opportunityNumber, hit);
      }
    }
    // 2) Remove closed/expired (no title/agency already dropped in normalizeHit).
    const filtered = [...byNumber.values()].filter((h) => isStillOpen(h.closeDate));

    // 3) PRE-RANK the raw hits by title/status BEFORE slicing, so the most
    //    promising candidates (SBIR/STTR, posted, on-domain) are the ones we
    //    enrich — otherwise later-appearing SBIR results get cut before we ever
    //    fetch their detail.
    const preRanked = filtered
      .map((h) => ({ h, s: rawScore(h, keywords) }))
      .sort((a, b) => b.s - a.s);
    const toEnrich = preRanked.slice(0, MAX_ENRICH).map((x) => x.h);

    // Enrich the chosen candidates (with retries inside enrichOpportunity).
    const enriched: Opportunity[] = await Promise.all(
      toEnrich.map((raw) => enrichOpportunity(raw))
    );

    // 4) Re-rank with full detail (description-aware) and take the top N.
    const scored = enriched
      .map((o) => ({ o, score: relevanceScore(o, keywords) }))
      .sort((a, b) => b.score - a.score);
    const now = new Date().toISOString();
    const opportunities = scored
      .map((s) => s.o)
      .slice(0, MAX_RESULTS)
      .map((o) => ({ ...o, source: "Grants.gov" as const, lastCheckedAt: now }));

    const meta = {
      searched: queries.length,
      candidates: filtered.length,
      found: enriched.length,
      detailed: enriched.filter(hasUsableDetail).length,
      returned: opportunities.length,
    };
    // Visible in the dev terminal — quick signal of discovery quality.
    console.log("[/api/opportunities] meta:", meta);
    console.log(
      "[/api/opportunities] top:",
      scored
        .slice(0, MAX_RESULTS)
        .map((s) => `${s.score.toFixed(0)} ${s.o.status ?? "?"} ${s.o.opportunityNumber} ${(s.o.title ?? "").slice(0, 50)}`)
    );

    return NextResponse.json({ opportunities, meta });
  } catch (err) {
    console.error("[/api/opportunities] error:", err);
    // Fail soft: return an empty list so the flow can continue with evidence, etc.
    return NextResponse.json({ opportunities: [], error: "Discovery failed." });
  }
}

/**
 * Cheap relevance score of an opportunity against the startup's keywords.
 * Title matches count most; description/eligibility count less. A usable
 * description adds a boost (Claude can only evaluate what it can read). This is a
 * fast pre-rank — Claude still does the real, nuanced ranking on the top slice.
 */
function relevanceScore(o: Opportunity, keywords: string[]): number {
  const title = norm(o.title);
  const body = norm(`${o.description ?? ""} ${o.eligibility ?? ""}`);
  const terms = keywordTerms(keywords);

  let score = 0;
  for (const kw of keywords.map(norm)) {
    if (kw && title.includes(kw)) score += 6; // full keyword phrase in title
    if (kw && body.includes(kw)) score += 2; // full keyword phrase in body
  }
  for (const t of terms) {
    if (title.includes(t)) score += 2; // single term in title
    if (body.includes(t)) score += 0.4; // single term in body
  }
  if (hasUsableDetail(o)) score += 3; // evaluable by Claude

  // Prefer opportunities you can actually apply to now.
  if ((o.status ?? "").toLowerCase() === "posted") score += 5;
  else if ((o.status ?? "").toLowerCase() === "forecasted") score -= 4;

  const blob = `${title} ${body}`;
  // SBIR/STTR is THE federal funding path for startups: boost it strongly even
  // when the (generic omnibus) title doesn't contain the startup's domain words.
  if (/small business innovation research|small business technology transfer|\bsbir\b|\bsttr\b/.test(blob)) {
    score += 10;
  }
  // Being open to small businesses at all is a good sign for a startup.
  if (/small business|small businesses/.test(blob)) score += 3;

  // Heavily deprioritize announcements you can't apply to yet.
  if (/notice of intent|intent to publish|forecast to publish|not accepting applications/.test(title)) {
    score -= 8;
  }
  return score;
}

/**
 * Cheap PRE-rank on a raw search hit (title + status only — no description yet).
 * Decides which candidates are worth enriching. Mirrors relevanceScore's signals
 * that are available before enrichment, especially the SBIR/STTR boost.
 */
function rawScore(raw: RawOpportunity, keywords: string[]): number {
  const title = norm(raw.title);
  let s = 0;
  for (const kw of keywords.map(norm)) {
    if (kw && title.includes(kw)) s += 6;
  }
  for (const t of keywordTerms(keywords)) {
    if (title.includes(t)) s += 2;
  }
  if ((raw.oppStatus ?? "").toLowerCase() === "posted") s += 5;
  else if ((raw.oppStatus ?? "").toLowerCase() === "forecasted") s -= 4; // prefer applyable
  if (/small business innovation research|small business technology transfer|\bsbir\b|\bsttr\b/.test(title)) {
    s += 10;
  }
  // Announcements you can't apply to yet.
  if (/notice of intent|intent to publish|forecast to publish|forecasted/.test(title)) s -= 8;
  return s;
}

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distinct meaningful terms (len >= 3) across all keywords. */
function keywordTerms(keywords: string[]): string[] {
  const set = new Set<string>();
  for (const kw of keywords) {
    for (const t of norm(kw).split(" ")) {
      if (t.length >= 3) set.add(t);
    }
  }
  return [...set];
}

/**
 * Build the search queries: the original keywords, plus SBIR/STTR-biased queries.
 * SBIR/STTR is the primary federal grant path for startups, so we always widen
 * the net toward it. Queries are de-duplicated and bounded.
 */
function buildQueries(keywords: string[]): string[] {
  const primary = keywords.slice(0, MAX_KEYWORDS);
  const topKw = primary[0];

  // STANDALONE SBIR/STTR queries (no domain words appended) so Grants.gov's
  // all-terms matching returns the generic omnibus parent solicitations — the
  // real startup funding vehicle. Then relevanceScore boosts + orders them.
  const sbir: string[] = [
    "small business innovation research",
    "small business technology transfer",
  ];
  // One domain-flavored SBIR query as well (helps when a topical SBIR exists).
  if (topKw) sbir.push(`SBIR ${topKw}`);

  // De-dupe case-insensitively while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of [...primary, ...sbir]) {
    const key = q.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(q.trim());
    }
  }
  // Bound the number of upstream searches.
  return out.slice(0, 9);
}
