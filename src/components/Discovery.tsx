"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/types";
import type { EntityType } from "@/lib/eligibility";
import { normalizeEntityType } from "@/lib/eligibility";
import { getDict } from "@/lib/translations";
import { EXAMPLES } from "@/lib/examples";

const ENTITY_STORAGE_KEY = "govmatch_entity_type";

// Dropdown options in display order (labels come from the translations dict).
const ENTITY_OPTIONS: { value: EntityType; labelKey:
  | "entitySmallBusiness"
  | "entityHigherEd"
  | "entityK12"
  | "entityNonprofit"
  | "entityGovernment"
  | "entityOther"; }[] = [
  { value: "small_business", labelKey: "entitySmallBusiness" },
  { value: "higher_education", labelKey: "entityHigherEd" },
  { value: "k12", labelKey: "entityK12" },
  { value: "nonprofit", labelKey: "entityNonprofit" },
  { value: "government", labelKey: "entityGovernment" },
  { value: "other", labelKey: "entityOther" },
];

interface DiscoveryProps {
  lang: Language;
  loading: boolean;
  loadingStep: 0 | 1 | 2 | 3;
  error: string | null;
  onSubmit: (description: string, entityType: EntityType) => void;
}

export function Discovery({
  lang,
  loading,
  loadingStep,
  error,
  onSubmit,
}: DiscoveryProps) {
  const t = getDict(lang);
  const [text, setText] = useState("");
  // Default to the typical founder so they don't have to think.
  const [entityType, setEntityType] = useState<EntityType>("small_business");

  // Load the persisted choice on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ENTITY_STORAGE_KEY);
      if (saved) setEntityType(normalizeEntityType(saved));
    } catch {
      /* ignore */
    }
  }, []);

  function updateEntity(next: EntityType) {
    setEntityType(next);
    try {
      window.localStorage.setItem(ENTITY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const steps = [t.stepUnderstanding, t.stepSearching, t.stepAnalyzing];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-center text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
        {t.discoveryTitle}
      </h1>

      <div className="card mt-8 p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.discoveryPlaceholder}
          rows={6}
          disabled={loading}
          className="w-full resize-y rounded-xl border border-slate-300 p-4 text-base
            leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-brand-400
            focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50"
        />

        {/* Entity-type selector — eligibility is judged against this. */}
        <div className="mt-4">
          <label
            htmlFor="entity-type"
            className="mb-1 block text-sm font-medium text-slate-600"
          >
            {t.entityTypeQuestion}
          </label>
          <select
            id="entity-type"
            value={entityType}
            disabled={loading}
            onChange={(e) => updateEntity(e.target.value as EntityType)}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base
              text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2
              focus:ring-brand-200 disabled:bg-slate-50"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t[o.labelKey]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={() => onSubmit(text.trim(), entityType)}
          className="btn-primary mt-4 w-full text-lg"
        >
          {loading ? t.loading : t.discoveryButton}
        </button>

        {/* Loading steps */}
        {loading && (
          <ol className="mt-5 space-y-2">
            {steps.map((label, i) => {
              const state =
                i < loadingStep ? "done" : i === loadingStep ? "active" : "todo";
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    state === "active"
                      ? "bg-brand-50 font-semibold text-brand-800"
                      : "text-slate-500"
                  }`}
                >
                  <span aria-hidden className="text-base">
                    {state === "done" ? "✅" : state === "active" ? "⏳" : "⬜"}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
        )}

        {error && !loading && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Example buttons — all 5 are startups, so they reset entity type. */}
      {!loading && (
        <div className="mt-8">
          <p className="mb-3 text-center text-sm font-medium text-slate-500">
            {t.examplesLabel}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.labelKey}
                type="button"
                onClick={() => {
                  setText(ex.text[lang]);
                  updateEntity("small_business");
                }}
                className="btn-secondary text-sm"
              >
                {t[ex.labelKey]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
