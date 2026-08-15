"use client";

import type {
  HistoricalEvidence,
  Language,
  Opportunity,
  OpportunityMatch,
} from "@/lib/types";
import { getDict } from "@/lib/translations";
import { formatDate, formatMoney, todayFormatted } from "@/lib/format";
import { describeAwardDisplay } from "@/lib/awardDisplay";
import {
  isNihSbirParent,
  nextStandardCycle,
  programReferenceText,
  NIH_SBIR_REFERENCE,
} from "@/lib/programReference";
import { SHOW_HISTORICAL_EVIDENCE } from "@/lib/featureFlags";
import { MatchBadge, SectionHeader } from "./common";

export function OpportunityDetail({
  lang,
  opportunity,
  match,
  evidence,
  onBack,
  onStart,
}: {
  lang: Language;
  opportunity: Opportunity;
  match: OpportunityMatch;
  evidence: HistoricalEvidence | null;
  onBack: () => void;
  onStart: () => void;
}) {
  const t = getDict(lang);
  const nihParent = isNihSbirParent(opportunity);
  const ref = programReferenceText(lang);
  const awardDisp = describeAwardDisplay(opportunity, lang);
  const deadlineValue = nihParent
    ? `${ref.nextCyclePrefix}${nextStandardCycle()}`
    : formatDate(opportunity.deadline) ?? t.notSpecified;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button type="button" onClick={onBack} className="btn-ghost mb-4">
        ← {t.back}
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight text-slate-900">
              {opportunity.title}
            </h2>
            {opportunity.agency && (
              <p className="mt-1 text-slate-500">{opportunity.agency}</p>
            )}
          </div>
          <MatchBadge
            fit={match.strategicFit}
            eligibility={match.eligibilityStatus}
            lang={lang}
          />
        </div>

        {/* Stats: THIS opportunity's official values first; NIH-parent standard
            reference is clearly flagged as "not from this FOA · verify". */}
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {awardDisp.label}
            </dt>
            <dd className="mt-0.5 text-lg font-bold text-slate-900">
              {awardDisp.asLink && opportunity.sourceUrl ? (
                <a
                  href={opportunity.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 underline"
                >
                  {awardDisp.value}
                </a>
              ) : (
                awardDisp.value
              )}
            </dd>
            {awardDisp.footnote && (
              <p className="mt-1 text-xs font-normal text-slate-400">{awardDisp.footnote}</p>
            )}
          </div>
          <Stat label={t.deadlineLabel} value={deadlineValue} />
          <Stat
            label={t.fundingType}
            value={opportunity.fundingType || t.notSpecified}
          />
        </dl>

        {nihParent && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm">
            <ul className="space-y-1 text-slate-700">
              <li>• {ref.deadlineStandard}</li>
              {formatDate(opportunity.deadline) && (
                <li className="text-slate-400">
                  • {ref.foaExpires} {formatDate(opportunity.deadline)}
                </li>
              )}
            </ul>
            <a
              href={NIH_SBIR_REFERENCE.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-brand-700 underline"
            >
              {ref.verifyLink} ↗
            </a>
          </div>
        )}
      </div>

      {/* ELIGIBILITY — code-determined from official data, with traceable reasons */}
      {match.eligibilityReasons?.length > 0 && (
        <div className="card mt-5 p-6">
          <SectionHeader icon="🪪">{t.eligibilityHeading}</SectionHeader>
          <ul className="space-y-3">
            {match.eligibilityReasons.map((r, i) => (
              <li key={i} className="text-sm">
                <p className="flex gap-2 font-semibold text-slate-900">
                  <span aria-hidden>
                    {r.result === "fails" ? "❌" : r.result === "passes" ? "✅" : "🔎"}
                  </span>
                  {r.requirement}
                </p>
                <p className="ml-6 text-slate-600">{r.companyFact}</p>
                <p className="ml-6 text-xs text-slate-400">
                  {t.sourceLabel}: {r.source}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* WHY YOU MATCH */}
      {match.whyItMatches?.length > 0 && (
        <div className="card mt-5 p-6">
          <SectionHeader icon="✓">{t.whyYouMatch}</SectionHeader>
          <ul className="space-y-3">
            {match.whyItMatches.map((w, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 text-emerald-600" aria-hidden>
                  {w.status || "✓"}
                </span>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {w.dimension}:
                  </span>{" "}
                  {w.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* WHY THIS MAY NOT WORK */}
      {match.whyItMayNotMatch?.length > 0 && (
        <div className="card mt-5 border-amber-200 bg-amber-50/40 p-6">
          <SectionHeader icon="⚠">{t.whyThisMayNotWork}</SectionHeader>
          <ul className="space-y-2">
            {match.whyItMayNotMatch.map((w, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="text-amber-600" aria-hidden>
                  ⚠
                </span>
                {w.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-amber-800">
            {t.verifyBeforeApplying}
          </p>
        </div>
      )}

      {/* POSSIBLE PROBLEMS */}
      {match.possibleBlockers?.length > 0 && (
        <div className="card mt-5 p-6">
          <SectionHeader icon="⚠">{t.possibleProblems}</SectionHeader>
          <ul className="space-y-2">
            {match.possibleBlockers.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="text-amber-600" aria-hidden>
                  ⚠
                </span>
                {b.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* HISTORICAL EVIDENCE — DISABLED via feature flag: the USAspending
          award-type/relevance filter isn't reliable (it surfaced large state
          grants as SBIR recipients). Code kept for easy re-enable. */}
      {SHOW_HISTORICAL_EVIDENCE && (
      <div className="card mt-5 p-6">
        <SectionHeader icon="📊">{t.historicalEvidence}</SectionHeader>
        {evidence &&
        (evidence.historicalRecipients ||
          evidence.medianAward ||
          evidence.largestAward) ? (
          <>
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              ⓘ {t.evidenceCaveat}
            </p>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat
                label={t.historicalRecipients}
                value={
                  evidence.historicalRecipients != null
                    ? evidence.historicalRecipients.toLocaleString("en-US")
                    : "—"
                }
              />
              <Stat
                label={t.medianAward}
                value={formatMoney(evidence.medianAward)}
              />
              <Stat
                label={t.largestAward}
                value={formatMoney(evidence.largestAward)}
              />
            </dl>
            {evidence.sampleAwards?.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {evidence.sampleAwards.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{s.recipient ?? "—"}</span>
                    <span className="font-medium text-slate-700">
                      {formatMoney(s.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-slate-400">{t.evidenceSource}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{t.noEvidence}</p>
        )}
      </div>
      )}

      {/* Footer: provenance — the specific source + when it was last retrieved. */}
      <div className="mt-5 space-y-1 text-xs text-slate-400">
        <p>
          {opportunity.source ?? t.sourceGrantsGov} · {t.opportunityNumber}
          {opportunity.opportunityNumber}
        </p>
        <p>
          {t.lastChecked}: {formatDate(opportunity.lastCheckedAt) ?? todayFormatted()} ·{" "}
          {opportunity.source ?? t.sourceGrantsGov}
        </p>
      </div>

      {/* Pre-flight readiness — the universal federal prerequisite (SAM.gov/UEI). */}
      {match.eligibilityStatus !== "ineligible" && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <SectionHeader icon="🪪">{t.readinessHeading}</SectionHeader>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span aria-hidden>⏳</span>
              {t.readinessSam}
            </li>
          </ul>
        </div>
      )}

      <button type="button" onClick={onStart} className="btn-primary mt-4 w-full text-lg">
        {t.startApplication} →
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-bold text-slate-900">{value}</dd>
    </div>
  );
}
