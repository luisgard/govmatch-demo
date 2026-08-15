import { fetchWithTimeout } from "./http";
import type { HistoricalEvidence, SampleAward } from "./types";

/**
 * USAspending.gov client — HISTORICAL EVIDENCE, kept strictly separate from
 * opportunities. This answers "companies got funded before by this kind of
 * program," NOT "this grant exists" and NOT "these recipients resemble you."
 *
 * All numbers come directly from the USAspending API.
 */

const SEARCH_URL =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const COUNT_URL =
  "https://api.usaspending.gov/api/v2/search/spending_by_award_count/";

// Grant assistance award types.
const GRANT_AWARD_TYPES = ["02", "03", "04", "05"];

function recentTimePeriod(): { start_date: string; end_date: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getFullYear() - 6, 0, 1).toISOString().slice(0, 10);
  return { start_date: start, end_date: end };
}

function buildFilters(keywords: string[]) {
  return {
    award_type_codes: GRANT_AWARD_TYPES,
    keywords: keywords.slice(0, 4),
    time_period: [recentTimePeriod()],
  };
}

interface AwardRow {
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number | string;
  "Awarding Agency"?: string;
  "Awarding Sub Agency"?: string;
  "Start Date"?: string;
  "Assistance Listing"?: string;
  [key: string]: unknown;
}

export async function fetchEvidence(
  keywords: string[]
): Promise<HistoricalEvidence> {
  const empty: HistoricalEvidence = {
    historicalRecipients: null,
    medianAward: null,
    largestAward: null,
    sampleAwards: [],
    source: "USAspending.gov",
  };

  if (keywords.length === 0) return empty;

  const filters = buildFilters(keywords);

  // Fetch a page of awards (for stats + samples) and the total grant count in
  // parallel. Either can fail independently.
  const [awards, totalCount] = await Promise.all([
    fetchAwards(filters),
    fetchCount(filters),
  ]);

  if (awards.length === 0 && totalCount === null) return empty;

  const amounts = awards
    .map((a) => toNumber(a["Award Amount"]))
    .filter((n): n is number => n !== null && n > 0)
    .sort((x, y) => x - y);

  const median =
    amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : null;
  const largest = amounts.length > 0 ? amounts[amounts.length - 1] : null;

  const sampleAwards: SampleAward[] = awards.slice(0, 5).map((a) => ({
    recipient: (a["Recipient Name"] as string) || null,
    amount: toNumber(a["Award Amount"]),
    agency:
      (a["Awarding Agency"] as string) ||
      (a["Awarding Sub Agency"] as string) ||
      null,
    awardType: "grant",
    date: (a["Start Date"] as string) || null,
    program: (a["Assistance Listing"] as string) || null,
  }));

  return {
    historicalRecipients: totalCount ?? amounts.length,
    medianAward: median,
    largestAward: largest,
    sampleAwards,
    source: "USAspending.gov",
  };
}

async function fetchAwards(filters: object): Promise<AwardRow[]> {
  try {
    const res = await fetchWithTimeout(
      SEARCH_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          fields: [
            "Award ID",
            "Recipient Name",
            "Award Amount",
            "Awarding Agency",
            "Awarding Sub Agency",
            "Start Date",
            "Assistance Listing",
          ],
          page: 1,
          limit: 100,
          sort: "Award Amount",
          order: "desc",
        }),
      },
      12000
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.results) ? (json.results as AwardRow[]) : [];
  } catch (err) {
    console.error("[usaspending] fetchAwards failed:", err);
    return [];
  }
}

async function fetchCount(filters: object): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      COUNT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      },
      12000
    );
    if (!res.ok) return null;
    const json = await res.json();
    const results = json?.results;
    if (results && typeof results === "object") {
      // Sum the grant buckets returned by the count endpoint.
      const grants = Number(results.grants ?? 0);
      const other = Number(results.other ?? 0);
      const total = grants + other;
      return Number.isFinite(total) && total > 0 ? total : null;
    }
    return null;
  } catch (err) {
    console.error("[usaspending] fetchCount failed:", err);
    return null;
  }
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
