"use client";

import { useMemo, useState } from "react";
import type {
  DynamicPlan,
  HistoricalEvidence,
  MatchCounts,
  MatchResult,
  Opportunity,
  OpportunityMatch,
  StartupProfile,
} from "@/lib/types";
import { useTranslation } from "@/lib/useTranslation";
import { Header } from "@/components/Header";
import { GlobalNotice } from "@/components/GlobalNotice";
import { Discovery } from "@/components/Discovery";
import {
  OpportunitiesList,
  type RankedOpportunity,
} from "@/components/OpportunitiesList";
import { OpportunityDetail } from "@/components/OpportunityDetail";
import { Wizard } from "@/components/Wizard";

type Screen = "discovery" | "list" | "detail" | "wizard";

export default function Home() {
  const { lang, setLang, t } = useTranslation();

  const [screen, setScreen] = useState<Screen>("discovery");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2 | 3>(0);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<StartupProfile | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [evidence, setEvidence] = useState<HistoricalEvidence | null>(null);
  const [honestNoMatch, setHonestNoMatch] = useState(false);
  const [summary, setSummary] = useState("");
  const [counts, setCounts] = useState<MatchCounts | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [plan, setPlan] = useState<DynamicPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Join opportunities with their match, ordered by Claude's ranking.
  const ranked: RankedOpportunity[] = useMemo(() => {
    const oppById = new Map(opportunities.map((o) => [o.opportunityNumber, o]));
    return matches
      .map((m) => {
        const opp = oppById.get(m.id);
        return opp ? { opportunity: opp, match: m } : null;
      })
      .filter((x): x is RankedOpportunity => x !== null);
  }, [opportunities, matches]);

  const selected = useMemo(
    () => ranked.find((r) => r.opportunity.opportunityNumber === selectedId) ?? null,
    [ranked, selectedId]
  );

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || `Request to ${url} failed.`);
    }
    return json as T;
  }

  async function runDiscovery(description: string, entityType: string) {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    try {
      // 1. Understand the company.
      const analysis = await postJson<{
        profile: StartupProfile;
        governmentTerms: { keywords: string[]; themes: string[] };
      }>("/api/analyze", { description, language: lang });
      setProfile(analysis.profile);
      const keywords = analysis.governmentTerms.keywords;

      // 2. Search real opportunities + historical evidence in parallel.
      setLoadingStep(1);
      const [oppRes, evRes] = await Promise.all([
        postJson<{ opportunities: Opportunity[] }>("/api/opportunities", {
          keywords,
        }).catch(() => ({ opportunities: [] as Opportunity[] })),
        postJson<{ evidence: HistoricalEvidence }>("/api/evidence", {
          keywords,
        }).catch(() => ({ evidence: null })),
      ]);
      const opps = oppRes.opportunities ?? [];
      setOpportunities(opps);
      setEvidence(evRes.evidence ?? null);

      // 3. Analyze relevance / rank.
      setLoadingStep(2);
      const matchRes = await postJson<MatchResult>("/api/match", {
        profile: analysis.profile,
        opportunities: opps,
        evidence: evRes.evidence ?? null,
        language: lang,
        entityType,
      });
      setMatches(matchRes.matches ?? []);
      setHonestNoMatch(Boolean(matchRes.honestNoMatch));
      setSummary(matchRes.summary ?? "");
      setCounts(matchRes.counts ?? null);

      setLoadingStep(3);
      setScreen("list");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : t.errorNoResults
      );
    } finally {
      setLoading(false);
    }
  }

  async function startApplication() {
    if (!selected) return;
    setPlanLoading(true);
    setPlanError(null);
    setPlan(null);
    setScreen("wizard");
    try {
      const res = await postJson<{ plan: DynamicPlan }>(
        "/api/application-plan",
        {
          opportunity: selected.opportunity,
          profile,
          language: lang,
        }
      );
      setPlan(res.plan);
    } catch (err) {
      console.error(err);
      setPlanError(
        err instanceof Error && err.message ? err.message : t.errorTitle
      );
    } finally {
      setPlanLoading(false);
    }
  }

  function resetAll() {
    setScreen("discovery");
    setProfile(null);
    setOpportunities([]);
    setMatches([]);
    setEvidence(null);
    setHonestNoMatch(false);
    setSummary("");
    setCounts(null);
    setSelectedId(null);
    setPlan(null);
    setError(null);
  }

  return (
    <div className="min-h-screen">
      <GlobalNotice lang={lang} />
      <Header lang={lang} setLang={setLang} onHome={resetAll} />

      <main>
        {screen === "discovery" && (
          <Discovery
            lang={lang}
            loading={loading}
            loadingStep={loadingStep}
            error={error}
            onSubmit={runDiscovery}
          />
        )}

        {screen === "list" && (
          <OpportunitiesList
            lang={lang}
            ranked={ranked}
            counts={counts}
            honestNoMatch={honestNoMatch}
            summary={summary}
            onSelect={(id) => {
              setSelectedId(id);
              setScreen("detail");
            }}
            onStartOver={resetAll}
          />
        )}

        {screen === "detail" && selected && (
          <OpportunityDetail
            lang={lang}
            opportunity={selected.opportunity}
            match={selected.match}
            evidence={evidence}
            onBack={() => setScreen("list")}
            onStart={startApplication}
          />
        )}

        {screen === "wizard" && selected && (
          <>
            {planLoading && (
              <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                <p className="mt-4 text-slate-600">{t.stepAnalyzing}</p>
              </div>
            )}
            {planError && !planLoading && (
              <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <p className="font-semibold text-red-700">{t.errorTitle}</p>
                <p className="mt-2 text-sm text-slate-600">{planError}</p>
                <button
                  type="button"
                  onClick={startApplication}
                  className="btn-primary mt-4"
                >
                  {t.tryAgain}
                </button>
              </div>
            )}
            {plan && !planLoading && (
              <Wizard
                lang={lang}
                opportunity={selected.opportunity}
                plan={plan}
                onExit={() => setScreen("detail")}
              />
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
        {t.globalNotice}
      </footer>
    </div>
  );
}
