import { NextRequest, NextResponse } from "next/server";
import { claudeJson, languageName } from "@/lib/anthropic";
import type { AnalyzeResult, Language } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/analyze
 * Claude extracts a structured profile AND translates startup language into
 * government language. Returns ONLY JSON.
 */
export async function POST(req: NextRequest) {
  let description = "";
  let language: Language = "en";
  try {
    const body = await req.json();
    description = typeof body.description === "string" ? body.description : "";
    language = body.language === "es" ? "es" : "en";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!description.trim()) {
    return NextResponse.json(
      { error: "Please describe your startup." },
      { status: 400 }
    );
  }

  const system = `You are GovMatch's intake analyst. Your ONLY job is to read a founder's
plain-language description of their startup and produce a clean structured profile PLUS a
translation of their startup language into the vocabulary the U.S. federal government uses
in grant programs.

Write all human-readable text in ${languageName(language)}.

Rules:
- Extract only what the founder actually stated or clearly implied. If a field is unknown,
  use null. NEVER invent a number, a location, or a fact.
- "governmentTerms.keywords" must be 5-8 formal terms a federal agency (NIH, NSF, DOE, DOD,
  SBA, EPA, etc.) would use to categorize this work — NOT the founder's marketing words.
  Example: "software that reduces administrative work for nurses" ->
  ["health information technology","clinical workflow","healthcare workforce",
   "artificial intelligence in health"].
- "governmentTerms.themes" are 2-4 broad program themes (e.g. "public health",
  "advanced manufacturing", "cybersecurity").

Respond with ONLY this JSON, no prose, no code fences:
{
  "profile": {
    "industry": string|null,
    "location": string|null,
    "employees": string|null,
    "revenue": string|null,
    "raised": string|null,
    "fundingNeed": string|null,
    "useOfFunds": string|null
  },
  "governmentTerms": {
    "keywords": string[],
    "themes": string[]
  }
}`;

  try {
    const result = await claudeJson<AnalyzeResult>({
      system,
      user: description,
      maxTokens: 1024,
      temperature: 0.1,
    });

    // Defensive normalization so downstream routes never crash.
    const keywords = Array.isArray(result?.governmentTerms?.keywords)
      ? result.governmentTerms.keywords.filter((k) => typeof k === "string" && k.trim())
      : [];
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "Could not extract search terms from the description." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      profile: result.profile ?? {},
      governmentTerms: {
        keywords: keywords.slice(0, 8),
        themes: Array.isArray(result?.governmentTerms?.themes)
          ? result.governmentTerms.themes.filter((t) => typeof t === "string")
          : [],
      },
    } satisfies AnalyzeResult);
  } catch (err) {
    console.error("[/api/analyze] error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
