import type { DynamicPlan, Language, Opportunity } from "./types";
import { getDict } from "./translations";
import { todayFormatted } from "./format";

/**
 * Build a downloadable Markdown file of the founder's DRAFTS plus a CHECKLIST to
 * work through INSIDE the official system. There is deliberately no single
 * signable "package" — the forms are completed on the official portal. This file
 * only organizes the founder's own preparation.
 */
export function buildPackageText(
  lang: Language,
  opportunity: Opportunity,
  plan: DynamicPlan,
  editedDrafts: Record<string, string>
): string {
  const t = getDict(lang);
  const lines: string[] = [];

  lines.push(`# ${t.appName} — ${t.prepareMaterials}`);
  lines.push("");
  lines.push(`**${opportunity.title}**`);
  if (opportunity.agency) lines.push(opportunity.agency);
  lines.push(`${t.opportunityNumber}${opportunity.opportunityNumber}`);
  if (opportunity.sourceUrl) lines.push(`${t.sourceGrantsGov}: ${opportunity.sourceUrl}`);
  lines.push(`${t.lastChecked}: ${todayFormatted()}`);
  lines.push("");
  lines.push(`> ${t.finalNoticeDynamic}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Checklist: base registrations
  lines.push(`## ${t.baseRegHeading}`);
  lines.push("");
  for (const r of plan.baseRegistrations ?? []) {
    lines.push(`- [ ] **${r.task}** — ${r.whatItIs}`);
    if (r.activeTime) lines.push(`  - ${t.yourTime}: ${r.activeTime}`);
    if (r.waitTime) lines.push(`  - ${t.governmentWait}: ${r.waitTime}`);
    if (r.warning) lines.push(`  - ⚠️ ${r.warning}`);
    if (r.officialLink) lines.push(`  - ${r.officialLink}`);
  }
  lines.push("");

  // Submission system
  if (plan.submissionSystem?.name) {
    lines.push(`## ${t.submissionHeading}`);
    lines.push("");
    lines.push(`- **${plan.submissionSystem.name}**`);
    if (plan.submissionSystem.note) lines.push(`  - ${plan.submissionSystem.note}`);
    if (plan.submissionSystem.officialUrl)
      lines.push(`  - ${plan.submissionSystem.officialUrl}`);
    lines.push("");
  }

  // Dynamic steps
  if ((plan.dynamicSteps ?? []).length) {
    lines.push(`## ${t.wizardTitle}`);
    lines.push("");
    for (const s of plan.dynamicSteps) {
      const tag = s.source === "verify-official" ? ` _(${t.verifyTag})_` : "";
      lines.push(`- [ ] **${s.title}**${tag} — ${s.whatItIs}`);
      if (s.conditionReason) lines.push(`  - ${t.whyStep}: ${s.conditionReason}`);
      if (s.activeTime) lines.push(`  - ${t.yourTime}: ${s.activeTime}`);
      if (s.waitTime) lines.push(`  - ${t.governmentWait}: ${s.waitTime}`);
      if (s.warning) lines.push(`  - ⚠️ ${s.warning}`);
      if (s.officialLink) lines.push(`  - ${s.officialLink}`);
    }
    lines.push("");
  }

  // Required forms
  if ((plan.requiredForms ?? []).length) {
    lines.push(`## ${t.requiredFormsHeading}`);
    lines.push("");
    for (const f of plan.requiredForms) {
      if (f.source === "verify-official" || !f.formName) {
        lines.push(`- [ ] ${t.formsVerifyNote}`);
      } else {
        lines.push(`- [ ] ${f.formName}`);
      }
    }
    lines.push("");
  }

  // Eligibility gate
  if ((plan.eligibilityGate ?? []).length) {
    lines.push(`## ${t.eligibilityGateHeading}`);
    lines.push("");
    for (const g of plan.eligibilityGate) {
      lines.push(`- [ ] ${g.question}`);
      if (g.ifFailImpact) lines.push(`  - ${t.ifFail}: ${g.ifFailImpact}`);
    }
    lines.push("");
  }

  // Drafts (with the founder's edits)
  if ((plan.drafts ?? []).length) {
    lines.push(`## ${t.draftsHeading}`);
    lines.push("");
    plan.drafts.forEach((d, i) => {
      const text = editedDrafts[`draft-${i}`] ?? d.draft;
      lines.push(`### ${d.sectionName}`);
      lines.push("");
      lines.push(text);
      lines.push("");
      if (lang === "es" && d.english) {
        lines.push(`**English version:**`);
        lines.push("");
        lines.push(d.english);
        lines.push("");
      }
    });
  }

  return lines.join("\n");
}
