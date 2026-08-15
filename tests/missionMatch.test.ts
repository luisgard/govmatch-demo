import { describe, it, expect } from "vitest";
import {
  applicantDomainText,
  missionDomainMismatch,
} from "@/lib/missionMatch";
import type { StartupProfile } from "@/lib/types";

const profile = (over: Partial<StartupProfile>): StartupProfile => ({
  industry: null,
  location: null,
  employees: null,
  revenue: null,
  raised: null,
  fundingNeed: null,
  useOfFunds: null,
  ...over,
});

const water = applicantDomainText(
  profile({ industry: "Municipal water infrastructure", useOfFunds: "Water leak detection sensors for utilities" })
);
const aerospace = applicantDomainText(profile({ industry: "Aerospace launch systems" }));
const cyber = applicantDomainText(profile({ industry: "Cybersecurity / network security" }));
const agri = applicantDomainText(profile({ industry: "Precision agriculture for crop yields" }));
const medtech = applicantDomainText(
  profile({ industry: "Medical device company", useOfFunds: "Clinical diagnostics for patients" })
);
const waterHealth = applicantDomainText(
  profile({ industry: "Water quality", useOfFunds: "Detecting waterborne disease to protect public health" })
);

describe("ADJUSTMENT — mission-vs-domain mismatch is uniform across sectors", () => {
  it("caps NIH for a WATER company (the reported bug)", () => {
    expect(missionDomainMismatch("National Institutes of Health", water).mismatch).toBe(true);
  });

  it("caps NIH for aerospace, cybersecurity, and agriculture identically", () => {
    expect(missionDomainMismatch("National Institutes of Health", aerospace).mismatch).toBe(true);
    expect(missionDomainMismatch("National Institutes of Health", cyber).mismatch).toBe(true);
    expect(missionDomainMismatch("National Institutes of Health", agri).mismatch).toBe(true);
  });

  it("does NOT cap NIH when the applicant genuinely intersects health/biomedical", () => {
    expect(missionDomainMismatch("National Institutes of Health", medtech).mismatch).toBe(false);
  });

  it("does NOT cap a water company that articulates a real public-health angle", () => {
    expect(missionDomainMismatch("National Institutes of Health", waterHealth).mismatch).toBe(false);
  });

  it("recognizes NIH Institutes/Centers and HHS health agencies too", () => {
    expect(missionDomainMismatch("National Cancer Institute (NCI)", water).mismatch).toBe(true);
    expect(missionDomainMismatch("AHRQ", water).mismatch).toBe(true);
    expect(missionDomainMismatch("Food and Drug Administration", water).mismatch).toBe(true);
  });

  it("reports the mission domain it checked", () => {
    expect(missionDomainMismatch("National Institutes of Health", water).domain).toBe("health/biomedical");
  });

  it("does NOT cap broad-mission agencies (left to the LLM's topic judgement)", () => {
    // NSF, DOE, DOD are intentionally not in the narrow-mission table.
    expect(missionDomainMismatch("National Science Foundation", water).mismatch).toBe(false);
    expect(missionDomainMismatch("Department of Energy", aerospace).mismatch).toBe(false);
    expect(missionDomainMismatch("Department of Defense", cyber).mismatch).toBe(false);
  });

  it("is safe on empty/unknown agency", () => {
    expect(missionDomainMismatch("", water).mismatch).toBe(false);
    expect(missionDomainMismatch(null, water).mismatch).toBe(false);
    expect(missionDomainMismatch("Some Unknown Agency", water).mismatch).toBe(false);
  });
});
