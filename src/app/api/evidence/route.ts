import { NextRequest, NextResponse } from "next/server";
import { fetchEvidence } from "@/lib/usaspending";
import type { HistoricalEvidence } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/evidence — historical evidence from USAspending.gov.
 * SEPARATE from opportunities. Returns a HistoricalEvidence object.
 * Fails soft: if the source is down, returns an empty-but-valid object so the
 * rest of the flow keeps working.
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

  const emptyEvidence: HistoricalEvidence = {
    historicalRecipients: null,
    medianAward: null,
    largestAward: null,
    sampleAwards: [],
    source: "USAspending.gov",
  };

  try {
    const evidence = await fetchEvidence(keywords);
    return NextResponse.json({ evidence });
  } catch (err) {
    console.error("[/api/evidence] error:", err);
    return NextResponse.json({ evidence: emptyEvidence });
  }
}
