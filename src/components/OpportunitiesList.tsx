"use client";

import type {
  Language,
  MatchCounts,
  Opportunity,
  OpportunityMatch,
} from "@/lib/types";
import { getDict } from "@/lib/translations";
import { formatDate } from "@/lib/format";
import { describeAwardDisplay } from "@/lib/awardDisplay";
import { isNihSbirParent, nextStandardCycle, programReferenceText } from "@/lib/programReference";
import { MatchBadge } from "./common";

export interface RankedOpportunity {
  opportunity: Opportunity;
  match: OpportunityMatch;
}

/** Award display: official-first, centralized in describeAwardDisplay. */
function AwardCell({ o, lang }: { o: Opportunity; lang: Language }) {
  const a = describeAwardDisplay(o, lang);
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-slate-400">{a.label}:</dt>
      <dd className="font-semibold text-slate-700">
        {a.asLink && o.sourceUrl ? (
          <a
            href={o.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {a.value}
          </a>
        ) : (
          a.value
        )}
        {a.footnote && (
          <span className="ml-1 text-xs font-normal text-slate-400">{a.footnote}</span>
        )}
      </dd>
    </div>
  );
}

/** Deadline: NIH SBIR/STTR parent → next standard cycle; else the official date. */
function deadlineText(o: Opportunity, lang: Language): string {
  const t = getDict(lang);
  if (isNihSbirParent(o)) {
    const ref = programReferenceText(lang);
    return `${ref.nextCyclePrefix}${nextStandardCycle()}`;
  }
  return formatDate(o.deadline) ?? t.notSpecified;
}

export function OpportunitiesList({
  lang,
  ranked,
  counts,
  honestNoMatch,
  summary,
  onSelect,
  onStartOver,
}: {
  lang: Language;
  ranked: RankedOpportunity[];
  counts?: MatchCounts | null;
  honestNoMatch: boolean;
  summary: string;
  onSelect: (id: string) => void;
  onStartOver: () => void;
}) {
  const t = getDict(lang);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {t.opportunitiesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t.opportunitiesSubtitle}</p>
        </div>
        <button type="button" onClick={onStartOver} className="btn-ghost">
          ↺ {t.startOver}
        </button>
      </div>

      {/* Code-computed counts — always consistent with the cards below. */}
      {counts && (counts.reviewed > 0 || counts.shown > 0) && (
        <p className="mt-3 text-xs text-slate-500">
          {counts.reviewed} {t.countReviewed} · {counts.shown} {t.countShown}
          {counts.filtered > 0 ? ` · ${counts.filtered} ${t.countFiltered}` : ""}
        </p>
      )}

      {honestNoMatch && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-900">😕 {t.noMatchesTitle}</p>
          {summary && (
            <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
              {summary}
            </p>
          )}
        </div>
      )}

      {!honestNoMatch && summary && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {summary}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {ranked.map(({ opportunity, match }) => (
          <button
            key={opportunity.opportunityNumber}
            type="button"
            onClick={() => onSelect(opportunity.opportunityNumber)}
            className="card block w-full p-5 text-left transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold leading-snug text-slate-900">
                {opportunity.title}
              </h3>
              <MatchBadge
                fit={match.strategicFit}
                eligibility={match.eligibilityStatus}
                lang={lang}
              />
            </div>
            {opportunity.agency && (
              <p className="mt-1 text-sm text-slate-500">{opportunity.agency}</p>
            )}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <AwardCell o={opportunity} lang={lang} />
              <div className="flex items-center gap-1.5">
                <dt className="text-slate-400">{t.deadlineLabel}:</dt>
                <dd className="font-semibold text-slate-700">
                  {deadlineText(opportunity, lang)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm font-medium text-brand-700">
              {t.viewDetails} →
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
