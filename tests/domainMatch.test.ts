import { describe, it, expect } from "vitest";
import { applyDomainMismatchCap } from "@/lib/matchLogic";
import type { OpportunityMatch } from "@/lib/types";

const match = (over: Partial<OpportunityMatch>): OpportunityMatch => ({
  id: "OPP-1",
  strategicFit: "moderate",
  eligibilityStatus: "eligible",
  eligibilityReasons: [],
  whyItMatches: [],
  whyItMayNotMatch: [],
  possibleBlockers: [],
  whatToVerify: [],
  nextSteps: [],
  ...over,
});

const REASON = "Outside this agency's core mission domain; topic alignment is the main barrier.";

describe("ADJUSTMENT — strategic fit reflects domain match", () => {
  it("forces fit to 'low' when the opportunity is flagged outside the agency's mission", () => {
    const before = [match({ id: "NIH-SBIR", strategicFit: "moderate" })];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].strategicFit).toBe("low");
  });

  it("prepends the code-owned mission-mismatch reason so badge and prose agree", () => {
    const before = [match({ id: "NIH-SBIR", strategicFit: "moderate" })];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].whyItMayNotMatch[0].detail).toBe(REASON);
  });

  it("never touches eligibility — a mission mismatch is a fit barrier, not an eligibility one", () => {
    const before = [match({ id: "NIH-SBIR", eligibilityStatus: "eligible" })];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].eligibilityStatus).toBe("eligible");
  });

  it("leaves opportunities that are within the agency's mission unchanged", () => {
    const before = [match({ id: "USDA-SBIR", strategicFit: "high" })];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].strategicFit).toBe("high");
    expect(after[0].whyItMayNotMatch).toHaveLength(0);
  });

  it("does not duplicate the reason if it is already present", () => {
    const before = [
      match({ id: "NIH-SBIR", strategicFit: "low", whyItMayNotMatch: [{ detail: REASON }] }),
    ];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].whyItMayNotMatch).toHaveLength(1);
  });

  it("re-sorts so a now-low mismatch sinks below an eligible high-fit match", () => {
    const before = [
      match({ id: "NIH-SBIR", strategicFit: "moderate", eligibilityStatus: "eligible" }),
      match({ id: "USDA-SBIR", strategicFit: "high", eligibilityStatus: "eligible" }),
    ];
    const after = applyDomainMismatchCap(before, new Set(["NIH-SBIR"]), REASON);
    expect(after[0].id).toBe("USDA-SBIR"); // high-fit float above the capped mismatch
    expect(after[1].id).toBe("NIH-SBIR");
  });
});
