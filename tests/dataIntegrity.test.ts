import { describe, it, expect } from "vitest";
import { awardParts } from "@/lib/format";
import { assessStartupEligibility } from "@/lib/eligibility";
import {
  annotateEligibility,
  applyStrategicFitCap,
  buildMatches,
  computeCounts,
} from "@/lib/matchLogic";
import type {
  EligibilityReason,
  EligibilityStatus,
  Opportunity,
  OpportunityMatch,
  StrategicFit,
} from "@/lib/types";
import type { MechanismClass } from "@/lib/eligibility";

const baseOpp = (over: Partial<Opportunity>): Opportunity => ({
  opportunityNumber: "X",
  title: "T",
  agency: "A",
  description: null,
  eligibility: null,
  deadline: null,
  awardFloor: null,
  awardCeiling: null,
  sourceUrl: null,
  ...over,
});

/* Award & deadline are official-only (no cross-opportunity, no inference). */
describe("award is official-only", () => {
  it("null award → 'none' (UI shows a fallback, never another opp's number)", () => {
    expect(awardParts(null, null).kind).toBe("none");
  });
  it("uses the opportunity's own values", () => {
    expect(awardParts(500000, 2090000)).toEqual({ kind: "range", value: "$500K – $2.1M" });
  });
  it("only-ceiling and only-floor are distinct", () => {
    expect(awardParts(null, 2000000).kind).toBe("ceiling");
    expect(awardParts(500000, null).kind).toBe("floor");
  });
  it("a USAspending median can never become an award", () => {
    const opp = baseOpp({ awardFloor: null, awardCeiling: null });
    const median = 780000;
    void median;
    expect(awardParts(opp.awardFloor, opp.awardCeiling).kind).toBe("none");
  });
});

/* Eligibility is evidence-based (no global mechanism rule). */
describe("eligibility is evidence-based", () => {
  it("ineligible when the FOA's applicant types exclude the entity", () => {
    const r01 = baseOpp({
      title: "Research Grant (R01)",
      applicantTypes: ["Higher Education Institutions", "Nonprofits"],
    });
    const a = assessStartupEligibility(r01);
    expect(a.status).toBe("ineligible");
    expect(a.reasons[0].result).toBe("fails");
  });

  it("SBIR is eligible for a small business by structural rule even with no applicant types", () => {
    const sbir = baseOpp({ title: "Parent SBIR (R43/R44)", applicantTypes: [] });
    expect(assessStartupEligibility(sbir).status).toBe("eligible");
  });

  it("requires_verification when a non-SBIR FOA gives no applicant types", () => {
    const unknown = baseOpp({ title: "Some Center (RM1)", applicantTypes: [] });
    expect(assessStartupEligibility(unknown).status).toBe("requires_verification");
  });

  it("Phase IIB → PREMATURE (not a vague requires_verification)", () => {
    const iib = baseOpp({
      title: "SBIR Phase IIB Bridge Award (R44)",
      applicantTypes: ["Small businesses"],
    });
    expect(assessStartupEligibility(iib).status).toBe("premature");
  });

  it("every non-eligible result carries a traceable reason", () => {
    const r01 = baseOpp({ applicantTypes: ["Nonprofits"], title: "R01" });
    const a = assessStartupEligibility(r01);
    a.reasons.forEach((r: EligibilityReason) => {
      expect(r.requirement).toBeTruthy();
      expect(r.source).toBeTruthy();
    });
  });
});

/* Strategic fit is a SEPARATE axis, capped consistently for research mechanisms. */
describe("two axes: strategic fit is separate from eligibility", () => {
  const mk = (id: string, fit: StrategicFit, elig: EligibilityStatus): OpportunityMatch => ({
    id,
    strategicFit: fit,
    eligibilityStatus: elig,
    eligibilityReasons: [],
    whyItMatches: [],
    whyItMayNotMatch: [],
    possibleBlockers: [],
    whatToVerify: [],
    nextSteps: [],
  });

  it("research mechanisms are capped to LOW fit for a small business — R01 and RM1 alike", () => {
    const mechById = new Map<string, MechanismClass>([
      ["r01", "research"],
      ["rm1", "research"],
      ["sbir", "sbir"],
    ]);
    const capped = applyStrategicFitCap(
      [mk("r01", "high", "eligible"), mk("rm1", "high", "eligible"), mk("sbir", "high", "eligible")],
      mechById,
      "small_business"
    );
    const byId = Object.fromEntries(capped.map((m) => [m.id, m.strategicFit]));
    expect(byId.r01).toBe("low"); // consistent with...
    expect(byId.rm1).toBe("low"); // ...the other research mechanism
    expect(byId.sbir).toBe("high"); // SBIR is not capped
  });

  it("the fit cap NEVER changes eligibility (eligible stays eligible)", () => {
    const mechById = new Map<string, MechanismClass>([["r01", "research"]]);
    const [m] = applyStrategicFitCap([mk("r01", "high", "eligible")], mechById, "small_business");
    expect(m.eligibilityStatus).toBe("eligible");
    expect(m.strategicFit).toBe("low");
  });

  it("annotateEligibility injects a plain statement for non-eligible states", () => {
    const phrases = { ineligible: "cannot lead", premature: "need prior Phase II", verify: "verify" };
    const out = annotateEligibility(
      [mk("a", "low", "ineligible"), mk("b", "moderate", "premature"), mk("c", "high", "eligible")],
      phrases
    );
    const byId = Object.fromEntries(out.map((m) => [m.id, m.whyItMayNotMatch[0]?.detail]));
    expect(byId.a).toBe("cannot lead");
    expect(byId.b).toBe("need prior Phase II");
    expect(byId.c).toBeUndefined(); // eligible → no injected barrier
  });
});

/* Counts always equal the visible cards; filtered reflects removals. */
describe("counts equal the visible match array", () => {
  const elig = (status: EligibilityStatus) => ({ status, reasons: [] as EligibilityReason[] });

  it("counts match the shown cards", () => {
    const ids = new Set(["a", "b", "c", "d"]);
    const eligById = new Map([
      ["a", elig("eligible")],
      ["b", elig("eligible")],
      ["c", elig("ineligible")],
      ["d", elig("ineligible")],
    ]);
    const raw = [
      { id: "a", strategicFit: "high" },
      { id: "b", strategicFit: "low" },
      { id: "c", strategicFit: "low" },
      { id: "d", strategicFit: "high" },
    ];
    const matches = buildMatches(raw, ids, eligById);
    const counts = computeCounts(4, matches);
    expect(counts.shown).toBe(matches.length);
    expect(counts.highFit + counts.moderateFit + counts.lowFit).toBe(matches.length);
    expect(counts.ineligibleOrVerify).toBe(2);
  });

  it("filtered (omitted) opportunities are not counted as shown", () => {
    const ids = new Set(["a", "b", "c"]);
    const eligById = new Map([
      ["a", elig("eligible")],
      ["b", elig("eligible")],
      ["c", elig("eligible")],
    ]);
    const raw = [
      { id: "a", strategicFit: "high" },
      { id: "b", strategicFit: "low" },
    ];
    const counts = computeCounts(3, buildMatches(raw, ids, eligById));
    expect(counts.reviewed).toBe(3);
    expect(counts.shown).toBe(2);
    expect(counts.filtered).toBe(1);
  });
});

/* The app ignores factual values an LLM tries to provide. */
describe("LLM cannot create opportunity facts", () => {
  it("award/deadline/sourceUrl from the LLM are discarded", () => {
    const ids = new Set(["a"]);
    const eligById = new Map([["a", { status: "eligible" as EligibilityStatus, reasons: [] }]]);
    const raw = [
      {
        id: "a",
        strategicFit: "high",
        awardRange: { minimum: 999, maximum: 999999 },
        deadline: "2099-01-01",
        sourceUrl: "https://evil.example.com",
      },
    ];
    const [m] = buildMatches(raw, ids, eligById);
    expect(m).not.toHaveProperty("awardRange");
    expect(m).not.toHaveProperty("deadline");
    expect(m).not.toHaveProperty("sourceUrl");
    expect(m.eligibilityStatus).toBe("eligible");
  });

  it("drops matches whose id is not a real reviewed opportunity", () => {
    const ids = new Set(["real"]);
    const eligById = new Map([["real", { status: "eligible" as EligibilityStatus, reasons: [] }]]);
    const raw = [
      { id: "invented", strategicFit: "high" },
      { id: "real", strategicFit: "low" },
    ];
    expect(buildMatches(raw, ids, eligById).map((m) => m.id)).toEqual(["real"]);
  });
});
