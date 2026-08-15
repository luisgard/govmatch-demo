# GovMatch

**Your copilot for U.S. federal funding.**

GovMatch helps non-technical startup founders (1) discover U.S. federal government
resources they may qualify for and (2) get guided, step by step, until their
application is nearly ready.

This repository contains **two** things:

1. **GovMatch** — a Next.js web app (this folder).
2. **GovMatch Autofill** — a companion Chrome extension (in [`/extension`](./extension)).

Build/run the web app first; the extension consumes data the web app produces.

---

## Live demo

**Try it:** <https://govmatch-demo-lime.vercel.app/>

No setup, no login — open the link and describe a startup (or pick one of the 5
built-in examples). GovMatch queries live Grants.gov data and returns ranked,
explained opportunities in seconds.

### Suggested demo path (2 minutes)

1. **A strong match** — pick the **AI health startup** example (or type your own).
   You'll see NIH SBIR/STTR come up as *"Eligible to lead · High strategic fit"* —
   the natural route — while academic research mechanisms (R01, RM1) are correctly
   shown as *"Low strategic fit"* with a plain-language reason. Every card explains
   **why it matches, why it may not, and what to verify.**

2. **The honest "no match"** — now try the **kids' activities marketplace**
   example. Watch GovMatch resist the temptation to invent a match: everything
   comes back *"Low strategic fit"*, and the summary says plainly that federal R&D
   grants aren't the right path — *"your primary funding path is more likely
   venture, angel, or revenue-based financing."* Most AI tools hallucinate an
   answer here; GovMatch tells the truth.

3. **The application wizard** — open any opportunity → *"Start application."*
   GovMatch builds a step-by-step plan from that specific opportunity's official
   listing, with **two clocks per step** (your hands-on time vs. the government's
   wait), drafts you can edit, and an honest boundary: it prepares everything and
   takes you to the door, but **you review, sign, and submit yourself** — because
   that final step is a legal signature no tool should automate.

### What makes it real

- Opportunities come from the **live Grants.gov API** — nothing is invented.
- **Code determines eligibility, amounts, and dates; Claude only explains them** —
  so the tool can't hallucinate a grant or a number into existence.
- It's **honest about limits**: discovery covers what agencies publish on
  Grants.gov (strongest for domains like health). Funding on agency-run portals
  (DoD, NASA, EPA) or annual cycles (USDA) is roadmap, not silently missing.

> **Note:** the demo makes live calls to Claude and public government APIs, so a
> search takes a few seconds. It's an AI-assisted analysis, not an official
> eligibility determination — always verify with the relevant agency.

---

## Core design principle

> **Claude EXPLAINS; official sources DETERMINE.**

Every time, requirement, dollar amount, deadline, eligibility rule, and URL comes
from official API/source metadata or from hardcoded constants
([`src/lib/officialLinks.ts`](./src/lib/officialLinks.ts)). Claude only phrases
those facts in human language and ranks/explains them. Claude is **never** the
source of truth for a fact and never invents a figure, a date, or a URL.

- Base-registration links (Login.gov, SAM.gov, Grants.gov) are hardcoded constants
  the code inserts — Claude never generates them.
- Opportunity-specific links use **only** the `sourceUrl` derived from the
  Grants.gov API. No API link → no link shown.
- "This grant exists" (opportunities, from Grants.gov) and "companies got funded
  before" (historical evidence, from USAspending.gov) are kept as two **separate**
  claims everywhere.

---

## Stack

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS**
- **Next.js API routes** for the backend
- **Anthropic SDK** (`@anthropic-ai/sdk`), model `claude-sonnet-4-6`
- Persistence via **localStorage** (no database, no login — this is a prototype)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Anthropic API key

The app reads the key **only** from the environment variable
`ANTHROPIC_API_KEY` — it is never hardcoded.

```bash
cp .env.example .env.local
```

Then edit `.env.local` and paste your key (get one at
<https://console.anthropic.com/>):

```
ANTHROPIC_API_KEY=sk-ant-...your-real-key...
```

### 3. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

> **Network note:** the app calls two public U.S. government APIs at runtime —
> `api.grants.gov` and `api.usaspending.gov`. Make sure your machine can reach
> them. If one is temporarily down, the app degrades gracefully (it continues
> with whatever source is available and never crashes).

---

## Deploy a demo (Vercel)

This is a standard Next.js App Router app, so Vercel is the simplest host:

1. Push the project to a GitHub repo (or run `npx vercel` from the project root
   to deploy the folder directly).
2. In Vercel, **New Project → Import** the repo. Vercel auto-detects Next.js —
   no build config needed (`next build`).
3. **Project → Settings → Environment Variables:** add
   `ANTHROPIC_API_KEY` = your key. Redeploy.
4. Done. The API routes run as serverless functions and call the public
   Grants.gov / USAspending APIs at request time (no extra setup).

**Note on function limits:** the Claude calls (`/api/match`,
`/api/application-plan`) can take 20–60s. Every route declares
`maxDuration = 60`, which fits Vercel's **Hobby (free)** cap. On **Pro** you can
raise these to 300s for extra headroom. No database is required — all user
progress lives in the browser's localStorage.

Other options work too, with one caveat: **Netlify** and **Cloudflare Pages**
(`@cloudflare/next-on-pages`) run the API routes as serverless functions with
**shorter timeout caps** (Netlify ~10s free / ~26s paid), which the long Claude
calls can exceed. If you want no per-request timeout at all, host the Next.js
server on **Render**, **Railway**, or **Fly.io** (persistent Node server, `next
start`). For a frictionless demo, **Vercel** remains the simplest.

The **Chrome extension** is not "deployed" — it's loaded unpacked from the
`extension/` folder (see [`extension/README.md`](./extension/README.md)). On the
official sites it shows a **contextual guide** ("where you are · what's next"),
autofills non-sensitive fields, and guides the rest — it never submits or signs.

## How it works (the flow)

**Discovery → Opportunities list → Opportunity detail → Application wizard.**

1. **Discovery** — the founder describes their startup in plain language (or picks
   one of 5 examples) and declares their **organization type**, which drives the
   code-side eligibility assessment in step 5.
2. **`/api/analyze`** — Claude extracts a structured profile and translates the
   startup's marketing language into the *government's* vocabulary (5–8 keywords).
3. **`/api/opportunities`** — searches Grants.gov (`search2`) for each keyword,
   then runs a quality filter (dedupe by opportunity number → drop closed/expired
   or untitled → normalize → enrich the top results with the full synopsis).
4. **`/api/evidence`** — *separately* queries USAspending.gov for historical grant
   awards (recipient count, median/largest award, sample awards).
5. **`/api/match`** — Claude ranks **only** the real, filtered opportunities and
   produces a structured match per opportunity (why it matches, why it may not,
   blockers, what to verify, next steps). Two **separate axes** are shown and never
   conflated:
   - **Eligibility** (`eligibilityStatus`) — determined by **code** from the FOA's
     declared applicant types, judged against the user's declared **entity type**
     (small business, university, nonprofit, government, K-12, other). Claude never
     sets or overrides it.
   - **Strategic fit** (`strategicFit`, high/moderate/low) — Claude's judgement of
     how well it suits the applicant's stage, then **code-capped** for consistency:
     research/institutional mechanisms (R01, RM1, P/U/K/T/F) are capped to "low" for
     a commercial startup, and any opportunity clearly **outside the funding
     agency's core mission** is forced to "low" so the badge can never contradict
     the summary.

   All counts are computed by code from the exact displayed list. If nothing fits
   well, it honestly says so instead of forcing a recommendation.
6. **Opportunity detail** — the founder decides "is this worth my time?" *before*
   the wizard.
7. **`/api/application-plan`** — for the chosen opportunity, it first calls
   Grants.gov **`fetchOpportunity`** to read *that* FOA's real detail (synopsis,
   required forms/packages, related links), then Claude builds a **dynamic** plan
   tailored to what THIS opportunity actually declares — not a fixed template.
   Steps appear conditionally (e.g. a Letter of Intent or cost-sharing step only
   when the FOA declares one), each tagged **FOA** (grounded in the listing) or
   **verify-official** (confirm on the portal). Base registrations keep fixed
   official times/warnings and their links come from the constants file. If
   `fetchOpportunity` or Claude fails, it degrades gracefully to the base
   registrations plus a single "verify on the official portal" step — the wizard
   is never left broken. Every step carries **two** time estimates: hands-on
   "active time" and passive "government wait."
8. **Application wizard** — one step per screen driven by the dynamic plan
   (progress shown as "step X of N"), with an honest banner ("every agency's
   process differs…"), interactive checklist, "verify" tags on unconfirmed steps,
   the eligibility gate shown *before* drafting, copy buttons, and editable
   drafts. The final **"Prepare your materials"** step organizes the founder's
   drafts + a checklist to complete *inside* the official system (there is no
   single signable package). It also saves `prefillData` under
   `localStorage["govmatch_prefill"]` for the Chrome extension.

---

## Multi-language (English / Spanish)

- An **ES/EN** switch sits top-right on every screen; the choice is saved in
  localStorage.
- **UI text** comes from a simple dictionary
  ([`src/lib/translations.ts`](./src/lib/translations.ts)) via a small
  `useTranslation` hook — no i18n routing libraries.
- **Claude's dynamic content** is generated *directly* in the active language
  (the language is passed to every route and the system prompts instruct Claude to
  write in it, not translate afterward).
- Because official U.S. forms are in English, in Spanish mode Claude drafts in
  Spanish **and** provides a "View English version ready to paste" per draft.

---

## Project structure

```
src/
  app/
    layout.tsx, page.tsx, globals.css   # shell + flow orchestrator
    api/
      analyze/route.ts                  # profile + government-language extraction
      opportunities/route.ts            # Grants.gov discovery + quality filter
      evidence/route.ts                 # USAspending.gov historical evidence
      match/route.ts                    # Claude fit ranking; code owns eligibility/facts
      application-plan/route.ts         # dynamic, per-opportunity application plan
  components/                           # Discovery, list, detail, wizard, etc.
  lib/
    officialLinks.ts                    # hardcoded official URLs (source of truth)
    eligibility.ts                      # code-side eligibility by entity type + mechanism
    matchLogic.ts                       # pure two-axis match logic (fit caps, counts)
    awardDisplay.ts                     # how award amounts are displayed (per-year, footnotes)
    programReference.ts                 # NIH SBIR standard-amount reference (clearly flagged)
    featureFlags.ts                     # e.g. SHOW_HISTORICAL_EVIDENCE
    types.ts, format.ts, storage.ts     # shared types + helpers
    grantsgov.ts, usaspending.ts, http.ts  # official API clients + fetch helper
    anthropic.ts                        # Anthropic client + robust JSON parsing
    translations.ts, useTranslation.ts  # i18n dictionary + hook
    examples.ts, buildPackage.ts
tests/                                  # vitest unit tests (see "Tests" below)
extension/                              # Chrome extension (see extension/README.md)
```

---

## Tests

Pure logic (eligibility, the two-axis match caps, entity-type rules, display
formatting) is covered by **[vitest](https://vitest.dev/)** unit tests in
[`tests/`](./tests). They run offline — no API key or network needed.

```bash
npm test
```

These deliberately assert the source-of-truth guarantees (e.g. Claude's numbers
are stripped from summaries, research mechanisms are capped to low fit, a domain
mismatch forces low fit, non-NIH programs never inherit NIH figures).

---

## Error handling

Every route uses `try/catch` and hard timeouts on outbound requests. If a
government API fails, the flow continues with the other source; if Claude fails, a
friendly error and a retry are shown. The demo should not crash.

---

## Disclaimer

GovMatch provides **AI-assisted analysis, not an official eligibility
determination.** Always verify with the relevant agency. You review, sign, and
submit everything yourself on the official portals.
