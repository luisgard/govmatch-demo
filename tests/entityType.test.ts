import { describe, it, expect } from "vitest";
import { assessEligibility } from "@/lib/eligibility";
import type { Opportunity } from "@/lib/types";

const opp = (applicantTypes: string[], title = "T"): Opportunity => ({
  opportunityNumber: "X",
  title,
  agency: "A",
  description: null,
  eligibility: null,
  deadline: null,
  awardFloor: null,
  awardCeiling: null,
  sourceUrl: null,
  applicantTypes,
});

describe("eligibility is symmetric on the user's entity type", () => {
  const r01 = opp(["Higher Education Institutions", "Nonprofits"], "Research Grant (R01)");

  it("a for-profit startup is INELIGIBLE for an academic-only R01", () => {
    expect(assessEligibility(r01, "small_business").status).toBe("ineligible");
  });

  it("a university is ELIGIBLE for the SAME R01 (its natural mechanism)", () => {
    expect(assessEligibility(r01, "higher_education").status).toBe("eligible");
  });

  it("a nonprofit is ELIGIBLE for the same R01", () => {
    expect(assessEligibility(r01, "nonprofit").status).toBe("eligible");
  });

  const sbir = opp(["Small businesses"], "Parent SBIR (R43/R44)");

  it("a small business is ELIGIBLE for SBIR", () => {
    expect(assessEligibility(sbir, "small_business").status).toBe("eligible");
  });

  it("a university is INELIGIBLE for a small-business-only SBIR", () => {
    expect(assessEligibility(sbir, "higher_education").status).toBe("ineligible");
  });

  const govFoa = opp(["State governments", "County governments"], "State Program (X)");

  it("a government entity is ELIGIBLE for a government FOA; a startup is not", () => {
    expect(assessEligibility(govFoa, "government").status).toBe("eligible");
    expect(assessEligibility(govFoa, "small_business").status).toBe("ineligible");
  });
});

describe("guardrails unchanged", () => {
  it("empty applicant types → requires_verification for every entity type", () => {
    const o = opp([]);
    for (const et of ["small_business", "higher_education", "nonprofit", "government"] as const) {
      expect(assessEligibility(o, et).status).toBe("requires_verification");
    }
  });

  it('"other / not sure" → requires_verification even when types are known', () => {
    const o = opp(["Small businesses"]);
    expect(assessEligibility(o, "other").status).toBe("requires_verification");
  });

  it("default (no entity type) behaves as a for-profit small business", () => {
    const r01 = opp(["Higher Education Institutions"]);
    expect(assessEligibility(r01).status).toBe("ineligible");
  });
});
