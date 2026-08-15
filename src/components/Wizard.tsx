"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BaseRegistrationStep,
  ChecklistStatus,
  DynamicPlan,
  DynamicStep,
  Language,
  Opportunity,
  SavedProgress,
} from "@/lib/types";
import { getDict } from "@/lib/translations";
import { loadProgress, saveProgress, savePrefill } from "@/lib/storage";
import { CopyButton, SectionHeader } from "./common";
import { buildPackageText } from "@/lib/buildPackage";

/* A wizard "screen" — the plan is dynamic, so screens are built from the plan. */
type Screen =
  | { kind: "base" }
  | { kind: "submission" }
  | { kind: "dynamic"; index: number }
  | { kind: "forms" }
  | { kind: "eligibility" }
  | { kind: "drafts" }
  | { kind: "final" };

export function Wizard({
  lang,
  opportunity,
  plan,
  onExit,
}: {
  lang: Language;
  opportunity: Opportunity;
  plan: DynamicPlan;
  onExit: () => void;
}) {
  const t = getDict(lang);
  const oppId = opportunity.opportunityNumber;

  // Build the ordered list of screens from what THIS plan actually contains.
  const screens: Screen[] = useMemo(() => {
    const s: Screen[] = [{ kind: "base" }];
    if (plan.submissionSystem?.name) s.push({ kind: "submission" });
    (plan.dynamicSteps ?? []).forEach((_, index) =>
      s.push({ kind: "dynamic", index })
    );
    if ((plan.requiredForms ?? []).length) s.push({ kind: "forms" });
    // Eligibility gate comes BEFORE drafting so blockers surface early.
    if ((plan.eligibilityGate ?? []).length) s.push({ kind: "eligibility" });
    if ((plan.drafts ?? []).length) s.push({ kind: "drafts" });
    s.push({ kind: "final" });
    return s;
  }, [plan]);

  const [step, setStep] = useState(0);
  const [checklist, setChecklist] = useState<Record<string, ChecklistStatus>>({});
  const [editedDrafts, setEditedDrafts] = useState<Record<string, string>>({});

  // Load saved progress + expose prefill to the extension on mount.
  useEffect(() => {
    const saved = loadProgress(oppId);
    if (saved) {
      setStep(Math.min(saved.currentPhase ?? 0, screens.length - 1));
      setChecklist(saved.checklist ?? {});
      setEditedDrafts(saved.editedDrafts ?? {});
    }
    // Save prefill (fields + drafts) under the key the extension reads.
    savePrefill({
      fields: plan.prefillData?.fields ?? [],
      drafts: (plan.drafts ?? []).map((d, i) => ({
        key: `draft-${i}`,
        label: d.sectionName,
        value: d.draft,
        english: d.english,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId]);

  // Persist on any change.
  useEffect(() => {
    const progress: SavedProgress = {
      opportunityId: oppId,
      currentPhase: step,
      checklist,
      editedDrafts,
      updatedAt: new Date().toISOString(),
    };
    saveProgress(progress);
  }, [oppId, step, checklist, editedDrafts]);

  function cycleStatus(key: string) {
    setChecklist((prev) => {
      const order: ChecklistStatus[] = ["pending", "in_progress", "done"];
      const now = prev[key] ?? "pending";
      const next = order[(order.indexOf(now) + 1) % order.length];
      return { ...prev, [key]: next };
    });
  }

  const current = screens[step];
  const total = screens.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button type="button" onClick={onExit} className="btn-ghost mb-3">
        ← {t.back}
      </button>

      {/* Persistent honest banner */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚖️ {t.wizardBanner}
      </div>

      {/* Progress bar driven by the actual step count */}
      <ol className="flex items-center gap-1">
        {screens.map((_, i) => (
          <li
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < step ? "bg-brand-600" : i === step ? "bg-brand-400" : "bg-slate-200"
            }`}
          />
        ))}
      </ol>
      <p className="mt-2 text-xs font-semibold text-brand-700">
        {t.stepOf(step + 1, total)}
      </p>

      <div className="mt-4">
        {current?.kind === "base" && (
          <BaseScreen
            lang={lang}
            items={plan.baseRegistrations ?? []}
            checklist={checklist}
            onToggle={cycleStatus}
          />
        )}
        {current?.kind === "submission" && (
          <SubmissionScreen
            lang={lang}
            system={plan.submissionSystem}
            status={checklist["submission"] ?? "pending"}
            onToggle={() => cycleStatus("submission")}
          />
        )}
        {current?.kind === "dynamic" && (
          <DynamicScreen
            lang={lang}
            step={plan.dynamicSteps[current.index]}
            status={checklist[`dyn-${current.index}`] ?? "pending"}
            onToggle={() => cycleStatus(`dyn-${current.index}`)}
          />
        )}
        {current?.kind === "forms" && (
          <FormsScreen
            lang={lang}
            forms={plan.requiredForms ?? []}
            checklist={checklist}
            onToggle={cycleStatus}
          />
        )}
        {current?.kind === "eligibility" && (
          <EligibilityScreen
            lang={lang}
            gate={plan.eligibilityGate ?? []}
            checklist={checklist}
            onToggle={cycleStatus}
          />
        )}
        {current?.kind === "drafts" && (
          <DraftsScreen
            lang={lang}
            plan={plan}
            editedDrafts={editedDrafts}
            checklist={checklist}
            onEdit={(k, v) => setEditedDrafts((p) => ({ ...p, [k]: v }))}
            onToggle={cycleStatus}
          />
        )}
        {current?.kind === "final" && (
          <FinalScreen
            lang={lang}
            opportunity={opportunity}
            plan={plan}
            editedDrafts={editedDrafts}
          />
        )}
      </div>

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((p) => Math.max(0, p - 1))}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-40"
        >
          ← {t.prev}
        </button>
        {step < total - 1 && (
          <button
            type="button"
            onClick={() => setStep((p) => Math.min(total - 1, p + 1))}
            className="btn-primary"
          >
            {t.next} →
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Shared bits ------------------------------- */

function StatusToggle({
  lang,
  status,
  onToggle,
}: {
  lang: Language;
  status: ChecklistStatus;
  onToggle: () => void;
}) {
  const t = getDict(lang);
  const map: Record<ChecklistStatus, { icon: string; label: string; cls: string }> = {
    pending: { icon: "⬜", label: t.statusPending, cls: "text-slate-500" },
    in_progress: { icon: "⏳", label: t.statusInProgress, cls: "text-amber-600" },
    done: { icon: "✅", label: t.statusDone, cls: "text-emerald-600" },
  };
  const s = map[status];
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold ${s.cls}`}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </button>
  );
}

function TwoClocks({
  lang,
  activeTime,
  waitTime,
}: {
  lang: Language;
  activeTime: string | null;
  waitTime: string | null;
}) {
  const t = getDict(lang);
  if (!activeTime && !waitTime) return null;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {activeTime && (
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <span aria-hidden>⏱️</span> {t.yourTime}: {activeTime}
          </span>
        )}
        {waitTime && (
          <span className="flex items-center gap-1.5 text-slate-500">
            <span aria-hidden>⏳</span> {t.governmentWait}: {waitTime}
          </span>
        )}
      </div>
      {activeTime && (
        <p className="text-xs text-emerald-700">{t.reassurance(activeTime)}</p>
      )}
    </div>
  );
}

function VerifyTag({ lang }: { lang: Language }) {
  const t = getDict(lang);
  return (
    <span
      className="badge bg-amber-100 text-amber-800"
      title={t.verifyMeaning}
    >
      🔎 {t.verifyTag}
    </span>
  );
}

/**
 * Honest, contextual nudge to install the browser extension — shown right where
 * it helps (SAM.gov / Grants.gov form steps). Promises "autofill what we can +
 * guide the rest", never "we submit for you".
 */
function ExtensionCallout({ lang }: { lang: Language }) {
  const t = getDict(lang);
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4">
      <p className="text-sm text-slate-700">🧩 {t.extCalloutBody}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary mt-3 text-sm"
      >
        {open ? t.extHide : t.extInstallBtn}
      </button>
      {open && (
        <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
          <p className="font-semibold">{t.extHowTitle}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>{t.extStep1}</li>
            <li>{t.extStep2}</li>
            <li>{t.extStep3}</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function OfficialLinkButton({ lang, href }: { lang: Language; href: string | null }) {
  const t = getDict(lang);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-primary mt-3 text-sm"
    >
      🔗 {t.openOfficialPage}
    </a>
  );
}

/* --------------------------------- Screens --------------------------------- */

function BaseScreen({
  lang,
  items,
  checklist,
  onToggle,
}: {
  lang: Language;
  items: BaseRegistrationStep[];
  checklist: Record<string, ChecklistStatus>;
  onToggle: (k: string) => void;
}) {
  const t = getDict(lang);
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">{t.baseRegHeading}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.baseRegIntro}</p>
      <div className="mt-4 space-y-4">
        {items.map((item, i) => {
          const key = `base-${i}`;
          return (
            <div key={key} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-slate-900">{item.task}</h3>
                <StatusToggle
                  lang={lang}
                  status={checklist[key] ?? "pending"}
                  onToggle={() => onToggle(key)}
                />
              </div>
              {item.whatItIs && (
                <p className="mt-1.5 text-sm text-slate-600">{item.whatItIs}</p>
              )}
              <TwoClocks lang={lang} activeTime={item.activeTime} waitTime={item.waitTime} />
              {item.warning && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  ⚠️ {item.warning}
                </p>
              )}
              <OfficialLinkButton lang={lang} href={item.officialLink} />
              {/* The extension helps most on the SAM.gov / Grants.gov forms. */}
              {/(sam|grants)\.gov/i.test(item.officialLink ?? "") && (
                <ExtensionCallout lang={lang} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionScreen({
  lang,
  system,
  status,
  onToggle,
}: {
  lang: Language;
  system: DynamicPlan["submissionSystem"];
  status: ChecklistStatus;
  onToggle: () => void;
}) {
  const t = getDict(lang);
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">{t.submissionHeading}</h2>
      <div className="card mt-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-slate-900">{system.name}</h3>
          <StatusToggle lang={lang} status={status} onToggle={onToggle} />
        </div>
        {system.note && <p className="mt-1.5 text-sm text-slate-600">{system.note}</p>}
        <OfficialLinkButton lang={lang} href={system.officialUrl} />
      </div>
    </div>
  );
}

function DynamicScreen({
  lang,
  step,
  status,
  onToggle,
}: {
  lang: Language;
  step: DynamicStep;
  status: ChecklistStatus;
  onToggle: () => void;
}) {
  const t = getDict(lang);
  const isVerify = step.source === "verify-official";
  return (
    <div>
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
            {isVerify ? (
              <VerifyTag lang={lang} />
            ) : (
              <span className="badge bg-emerald-100 text-emerald-800" title={t.fromFOA}>
                ✓ FOA
              </span>
            )}
          </div>
          <StatusToggle lang={lang} status={status} onToggle={onToggle} />
        </div>

        {step.whatItIs && (
          <p className="mt-2 text-sm text-slate-600">{step.whatItIs}</p>
        )}

        {isVerify && (
          <p className="mt-2 text-xs font-medium text-amber-700">{t.verifyMeaning}</p>
        )}

        {step.conditionReason && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-500">{t.whyStep}: </span>
            {step.conditionReason}
          </p>
        )}

        <TwoClocks lang={lang} activeTime={step.activeTime} waitTime={step.waitTime} />

        {step.warning && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            ⚠️ {step.warning}
          </p>
        )}

        <OfficialLinkButton lang={lang} href={step.officialLink} />
      </div>
    </div>
  );
}

function FormsScreen({
  lang,
  forms,
  checklist,
  onToggle,
}: {
  lang: Language;
  forms: DynamicPlan["requiredForms"];
  checklist: Record<string, ChecklistStatus>;
  onToggle: (k: string) => void;
}) {
  const t = getDict(lang);
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">{t.requiredFormsHeading}</h2>
      <div className="mt-4 space-y-3">
        {forms.map((f, i) => {
          const key = `form-${i}`;
          const isVerify = f.source === "verify-official" || !f.formName;
          return (
            <div key={key} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                {isVerify ? (
                  <p className="text-sm text-slate-600">{t.formsVerifyNote}</p>
                ) : (
                  <p className="font-medium text-slate-800">{f.formName}</p>
                )}
                {isVerify && (
                  <span className="mt-1 inline-block">
                    <VerifyTag lang={lang} />
                  </span>
                )}
              </div>
              <StatusToggle
                lang={lang}
                status={checklist[key] ?? "pending"}
                onToggle={() => onToggle(key)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EligibilityScreen({
  lang,
  gate,
  checklist,
  onToggle,
}: {
  lang: Language;
  gate: DynamicPlan["eligibilityGate"];
  checklist: Record<string, ChecklistStatus>;
  onToggle: (k: string) => void;
}) {
  const t = getDict(lang);
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">
        {t.eligibilityGateHeading}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{t.eligibilityGateIntro}</p>
      <div className="mt-4 space-y-3">
        {gate.map((g, i) => {
          const key = `elig-${i}`;
          return (
            <div key={key} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{g.question}</h3>
                <StatusToggle
                  lang={lang}
                  status={checklist[key] ?? "pending"}
                  onToggle={() => onToggle(key)}
                />
              </div>
              {g.ifFailImpact && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span className="font-semibold">{t.ifFail}: </span>
                  {g.ifFailImpact}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftsScreen({
  lang,
  plan,
  editedDrafts,
  checklist,
  onEdit,
  onToggle,
}: {
  lang: Language;
  plan: DynamicPlan;
  editedDrafts: Record<string, string>;
  checklist: Record<string, ChecklistStatus>;
  onEdit: (key: string, value: string) => void;
  onToggle: (key: string) => void;
}) {
  const t = getDict(lang);
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">{t.draftsHeading}</h2>
      <div className="mt-4 space-y-4">
        {plan.drafts.map((section, i) => {
          const key = `draft-${i}`;
          const value = editedDrafts[key] ?? section.draft;
          const ready = checklist[key] === "done";
          return (
            <DraftCard
              key={key}
              lang={lang}
              sectionName={section.sectionName}
              english={section.english}
              value={value}
              ready={ready}
              onChange={(v) => onEdit(key, v)}
              onReady={() => onToggle(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DraftCard({
  lang,
  sectionName,
  english,
  value,
  ready,
  onChange,
  onReady,
}: {
  lang: Language;
  sectionName: string;
  english?: string;
  value: string;
  ready: boolean;
  onChange: (v: string) => void;
  onReady: () => void;
}) {
  const t = getDict(lang);
  const [showEnglish, setShowEnglish] = useState(false);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-slate-900">{sectionName}</h3>
        <button
          type="button"
          onClick={onReady}
          className={`badge ${
            ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
          }`}
        >
          {ready ? `✅ ${t.ready}` : t.markReady}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">{t.editDraft}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-relaxed
          text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={value} lang={lang} label={t.copy} className="btn-secondary text-sm" />
        {lang === "es" && english && (
          <button
            type="button"
            onClick={() => setShowEnglish((s) => !s)}
            className="btn-ghost text-sm"
          >
            🇺🇸 {showEnglish ? t.hideEnglish : t.viewEnglish}
          </button>
        )}
      </div>
      {lang === "es" && english && showEnglish && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{english}</p>
          <div className="mt-2">
            <CopyButton
              text={english}
              lang={lang}
              label="Copy English"
              className="btn-secondary text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FinalScreen({
  lang,
  opportunity,
  plan,
  editedDrafts,
}: {
  lang: Language;
  opportunity: Opportunity;
  plan: DynamicPlan;
  editedDrafts: Record<string, string>;
}) {
  const t = getDict(lang);
  const prefillJson = useMemo(
    () => JSON.stringify({ fields: plan.prefillData?.fields ?? [] }, null, 2),
    [plan.prefillData]
  );

  function download() {
    const text = buildPackageText(lang, opportunity, plan, editedDrafts);
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GovMatch-${opportunity.opportunityNumber}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-900">{t.prepareMaterials}</h2>
      <p className="mt-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
        {t.prepareIntro}
      </p>

      {/* Prefill fields with copy + sensitivity markers */}
      {(plan.prefillData?.fields ?? []).length > 0 && (
        <div className="card mt-4 p-5">
          <SectionHeader icon="🧾">Prefill data</SectionHeader>
          <ul className="divide-y divide-slate-100">
            {plan.prefillData.fields.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {f.key}
                    {f.sensitive && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        🔒 sensitive
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-slate-500">{f.value}</p>
                </div>
                <CopyButton
                  text={f.value}
                  lang={lang}
                  label={t.copy}
                  className="btn-secondary shrink-0 text-xs"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mt-4 p-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={download} className="btn-primary">
            ⬇️ {t.downloadMaterials}
          </button>
          <CopyButton
            text={prefillJson}
            lang={lang}
            label={t.copyForExtension}
            className="btn-secondary"
          />
        </div>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ {t.finalNoticeDynamic}
        </p>
      </div>
    </div>
  );
}
