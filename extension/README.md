# GovMatch Autofill — Chrome Extension

A **Manifest V3** Chrome extension that helps founders fill official U.S.
government forms (**Grants.gov**, **SAM.gov**) using the data the GovMatch web
app prepared.

It runs in the founder's own browser, with **their** login/session. It **fills
non-sensitive fields and guides the rest** — it **never** submits, certifies,
signs, clicks the final button, or navigates on its own. **You review and sign.**

---

## What it does

**"Autofill this page"** does two things at once (hybrid mode):

- **A) Autofill** — for non-sensitive fields it maps *confidently*, it sets the
  value, dispatches `input`/`change` (so React/Vue forms register it), and
  highlights the field **green**: "✓ I filled this — please review."
- **B) Guide** — for everything else, **and always for sensitive fields** (legal
  name, EIN, UEI, bank, SSN) regardless of confidence, it highlights the field
  **yellow** with a note explaining *what* goes there, *where* to get it, and any
  *warnings* (e.g. "must EXACTLY match the IRS"). It highlights the page's
  "Save & Continue"-style button **blue** and tells you to click it yourself —
  but does not click it.

The popup shows an ordered checklist of what was **filled**, what you must
**fill yourself (guided)**, and what's **still to do**.

---

## "Your process" — the guided journey from zero

At the top of the panel is a **numbered checklist of the entire path**, from
creating your **Login.gov** account through a **submitted Grants.gov
application** — the milestones cross all three sites in order:

1. Create your Login.gov account → 2. Start SAM.gov Entity Registration (UEI) →
3. Validate your entity → 4. Core Data + banking → 5. Assertions → 6. Reps &
Certs → 7. Points of Contact → 8. Confirm "Active" + renewal → 9. Grants.gov
account + AOR → 10. Find an opportunity → 11. Complete Workspace forms → 12.
Review & have your AOR submit.

- The step matching the page you're on is highlighted with a **"you're here"**
  badge and auto-expands to show plain instructions and which official site to go
  to (root domains only — hard-coded constants).
- **Check off** each milestone as you finish it; a progress bar fills. Progress is
  **saved** (`chrome.storage`) and syncs across tabs, so the extension remembers
  your journey between visits.
- Every instruction is curated and human-written — no model runs, nothing invented.
- The panel has its own **EN/ES toggle** in the header, and defaults to your
  browser's language on first run (a stored choice always wins).
- **Compact by default.** The panel is small (≈288px, capped height with internal
  scroll) and shows **only your current step**; a **sticky header** always shows
  which step you're on (e.g. "Guía GovMatch · 2/12"). "See all 12 steps" expands
  the full list; "Show only my current step" collapses it again.
- **Points at the real button.** When the current step's action button is on the
  page (e.g. SAM.gov's **"Get Started"** under "Register Your Entity or Get a
  Unique Entity ID"), the panel scrolls to it, wraps it in a **pulsing ring**, and
  floats a **"👉 Click here: Get Started"** badge on it — and offers a "Show me the
  button" button to re-trigger. Targets are matched by the real `href` / visible
  text / class / CSS selector (see `STEP_TARGETS` in `stepGuide.js`); more pages
  are added as their DOM is confirmed.
- **Ordered sequences.** A page can have several things to do in order — e.g. the
  Login.gov create-account page is email → accept Rules of Use → Submit. The panel
  lists them numbered, auto-points at the FIRST one (the email field, not the
  submit button), and the badge reads "Type here" for fields vs "Click here" for
  buttons.

## Contextual guide — "where you are · what's next"

Below the journey, for the stage you're on, the panel tells you:

- **Where you are** — e.g. "Core Data — the backbone of your registration."
- **What's next** — the correct steps, in order.
- **Have ready** — the documents/data that stage needs.
- **You fill these yourself** — the sensitive fields (EIN, bank, MPIN…).

It recognizes the real stages of each process:

- **SAM.gov:** Unique Entity ID → Entity Validation → Core Data → Assertions →
  Reps & Certs → Points of Contact → dashboard/renewal.
- **Grants.gov:** Register / AOR → Search → Workspace → Submit.

### "On this page" — live DOM scan

Below the stage guidance, the panel **reads the actual page** and lists the real
form fields present, each mapped to a plain-language explanation from the concept
map ([`fieldMap.js`](./fieldMap.js)):

- A count — e.g. *"7 fields detected · 3 sensitive."*
- Each field as a row with its real label, a **🔒 sensitive** tag (EIN, legal
  name, UEI, bank…) and/or a **required** tag when the page marks it so.
- **Tap a field** → it scrolls to and **highlights the real element** on the page
  (blue for normal, red for sensitive). *"Highlight sensitive fields"* outlines
  them all at once.

The **facts** (which fields exist, their labels, whether they're required) come
straight from the page's DOM; the **explanations and sensitivity flags** come from
the curated concept map. Nothing here is generated by a model.

**How it stays trustworthy:** the guide is a **curated, human-written knowledge
base** ([`stepGuide.js`](./stepGuide.js)) matched against the page's own headings,
URL, and DOM. **No model runs at runtime**, so it can never invent a step or a URL
— the only URLs it references are the official root domains, as hard-coded
constants.
Every panel carries the reminder that *the official site always defines the steps*.
The panel follows the **ES/EN** toggle, survives the sites' single-page navigation,
and minimizes to a small pill. The popup mirrors the same summary under **"Where
you are."**

---

## Install (load unpacked)

1. Open **`chrome://extensions`** in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this **`extension/`** folder.
4. The **GovMatch Autofill** icon appears in your toolbar. Pin it if you like.

---

## Pass data from the web app

The web app never talks to the extension directly (that avoids CORS / cross-
origin issues). Instead, you hand the data over by copy-paste:

1. In the GovMatch web app, open an opportunity → **Application wizard** →
   **Prepare your materials**.
2. Click **"Copy data for the extension."** This copies the `prefillData` JSON
   (structured fields, each flagged **sensitive** or not).
3. Click the extension icon, paste the JSON into **"1 · Paste your data,"** and
   click **Save data**. It's stored in `chrome.storage` (not `localStorage` — the
   MV3 service worker has no DOM).

---

## Use it on a form

1. Open an official **Grants.gov** or **SAM.gov** form in a tab and sign in as
   usual. (Autofill only runs on those official domains — see
   `host_permissions` in `manifest.json`.)
2. Click the extension icon → **"2 · Autofill the open form"** →
   **Autofill this page**.
3. Review the **green** (filled) fields, complete the **yellow** (guided /
   sensitive) fields yourself, and work through the popup checklist.
4. **Clear highlights** removes all annotations when you're done.

---

## Field matching — how it decides (and how to tune it)

For each piece of data, the content script resolves a target field in this exact
order (see `content.js`):

1. **Exact selector** — from `fieldMap.js`
2. **fieldMap entry** — concept selectors
3. **Label matching** — the field's visible `<label>` text
4. **Semantic matching** — the input's `name` / `id` / `placeholder` / `aria-label`
5. **AI / best-guess** — a loose match → **guide only**, never auto-filled
6. **Manual guide** — nothing found on the page → listed as a to-do

Only levels **1–4** are considered "confident" enough to autofill (and only for
**non-sensitive**, currently-empty fields). Everything else is guided.

### Editing `fieldMap.js`

`fieldMap.js` is the file you edit to adapt to real forms. It's a list of
**concepts** (legal name, EIN, UEI, address, project title, …). For each concept
you can set:

- `dataKeywords` — how to recognize the concept in a prefill field's key
- `selectors` — **exact CSS selectors per host** (the most reliable; add these as
  you inspect real forms)
- `labelKeywords` / `semanticKeywords` — fallbacks
- `sensitive` — force "always guide" for that concept
- `guide` — the tooltip text (English + Spanish): what/where/warnings

Real government forms often use React, custom dropdowns, iframes, shadow DOM, or
multi-step flows. The most robust fix is almost always to add a precise
`selectors` entry pointing at the underlying `<input>`.

---

## Which pages it works on

- `https://*.grants.gov/*`
- `https://*.sam.gov/*`
- `https://secure.login.gov/*` — so the guided walkthrough continues onto the
  Login.gov sign-in step. On Login.gov the extension only READS the page to guide
  you and point at "Create an account"; it never reads, fills, or submits your
  email or password. Autofill is disabled on Login.gov entirely.

These are the only `host_permissions` requested (minimal permissions). The
popup, storage, and language toggle work everywhere, but **Autofill this page**
only runs on the domains above.

---

## Safety rules (hard-coded)

- **Never** auto-fills sensitive fields (legal name, EIN, UEI, bank, SSN) — always
  guides them.
- **Never** clicks Submit / Certify / Sign, never signs, never navigates on its
  own. It will only *highlight* a "Save & Continue" button and tell you to click
  it.
- The popup always shows: *"I review and fill non-sensitive fields for you. You
  review and sign. I don't submit anything on your behalf."*
- Fully **bilingual (ES / EN)**, consistent with the web app.

---

## Files

```
extension/
  manifest.json      # MV3 manifest, minimal permissions
  background.js      # service worker (no DOM); install defaults + fallback inject
  stepGuide.js       # journey checklist + contextual guide + DOM scan (curated)
  content.js         # DOM autofill + guide engine (the field-matching hierarchy)
  fieldMap.js        # EDIT ME — concept → selector/label/semantic map + guides
  popup/
    popup.html       # bilingual popup UI
    popup.js         # data handoff, autofill trigger, checklist report
  icons/             # 16 / 48 / 128 px icons
```
