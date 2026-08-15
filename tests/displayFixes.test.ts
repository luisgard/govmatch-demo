import { describe, it, expect } from "vitest";
import { stripMarkdown } from "@/lib/matchLogic";
import { describeAwardDisplay } from "@/lib/awardDisplay";
import type { Opportunity } from "@/lib/types";

const opp = (over: Partial<Opportunity>): Opportunity => ({
  opportunityNumber: "X",
  title: "T",
  agency: "NIH",
  description: null,
  eligibility: null,
  deadline: null,
  awardFloor: null,
  awardCeiling: null,
  sourceUrl: "https://www.grants.gov/search-results-detail/362551",
  ...over,
});

describe("FIX 4 — no raw markdown ever reaches the UI", () => {
  it("converts a markdown link to its visible text", () => {
    const md = "[See funding details in the FOA](https://www.grants.gov/search-results-detail/362551)";
    expect(stripMarkdown(md)).toBe("See funding details in the FOA");
  });
  it("drops bold/italic/code markers", () => {
    expect(stripMarkdown("**Strong** fit, `R01`, _note_")).toBe("Strong fit, R01, note");
  });
});

describe("FIX 2 — R01 award is reframed as per-year + multi-year", () => {
  it("shows /year framing, never a bare one-time total", () => {
    const r01 = opp({ title: "Clinical Informatics (R01)", awardCeiling: 250000, activityCode: "R01" });
    const a = describeAwardDisplay(r01, "en");
    expect(a.value).toMatch(/\/year/);
    expect(a.value).toMatch(/4-5 years/);
    expect(a.value).not.toBe("$250K"); // never a bare total
    expect(a.footnote).toMatch(/total/i); // total estimate present
  });
});

describe("FIX 3 helper — NIH SBIR parent standard is flagged; others link to FOA", () => {
  it("a non-NIH-parent with no official award links to the FOA (no NIH figures)", () => {
    const nsf = opp({ title: "NSF SBIR/STTR Phase I", agency: "National Science Foundation" });
    const a = describeAwardDisplay(nsf, "en");
    expect(a.asLink).toBe(true);
    expect(a.value).not.toMatch(/314K|2\.09M/); // never inherits NIH figures
  });
  it("an NIH SBIR parent shows standard amounts WITH a visible footnote", () => {
    const nih = opp({ title: "NIH Parent SBIR (R43/R44)", agency: "National Institutes of Health" });
    const a = describeAwardDisplay(nih, "en");
    expect(a.value).toMatch(/314K/);
    expect(a.footnote).toMatch(/not from this FOA/i); // asterisk is explained
  });
});
