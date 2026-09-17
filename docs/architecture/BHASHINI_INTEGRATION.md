# Bhashini Multilingual Integration — BhoomiSetu

This document explains what's been built, how it works, what's left to do, and how
teammates should add new translatable strings going forward.

---

## 1. What Bhashini Is and Why We Use It

[Bhashini](https://bhashini.gov.in/) is the Government of India's multilingual AI
API (part of the Digital India Bhashini mission). It gives us six services:

| Service | What it does | Status in this project |
|---|---|---|
| **NMT** (Translation) | Converts text between languages | ✅ Fully integrated |
| **Transliteration** | Converts script (e.g. Roman → Devanagari) without changing meaning | ✅ Backend ready, not wired to search yet |
| **TTS** (Text-to-Speech) | Reads text aloud | ✅ Backend ready, frontend not built yet |
| **ASR** (Speech-to-Text) | Converts spoken audio to text | ✅ Backend ready, frontend not built yet |
| **OCR** | Reads text from scanned documents | ❌ Blocked — not enabled on our account |
| **ALD** (Audio Language Detection) | Detects which language someone is speaking | ❌ Blocked — not enabled on our account |

We chose Bhashini over static translation files because:
- It supports all 22 scheduled Indian languages (we currently use 11), without us
  hand-writing/maintaining translation files per language.
- It's free and government-backed, appropriate for a government-facing platform.
- It gives us speech features (ASR/TTS) that static files can't provide.

---

## 2. Architecture Overview

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  React Frontend  │ ───▶ │  FastAPI Backend      │ ───▶ │  Bhashini API   │
│  (LanguageContext)│ ◀── │  (bhashini.py service)│ ◀── │  (ULCA/Dhruva)  │
└─────────────────┘      └──────────────────────┘      └─────────────────┘
        │                          │
        │                          ▼
        │                 static/ui_strings_<lang>.json
        │                 (pre-translated, cached — NOT live API calls)
        ▼
  localStorage (remembers selected language)
```

**Key design decision:** we do NOT call Bhashini live for every static UI string on
every page load. That would be slow and burn API quota fast for a site this size.
Instead:

- **Static UI text** (buttons, labels, headings, error messages) is translated
  **once**, via a batch script, and cached as JSON files. The frontend reads from
  these cached files instantly — zero live API calls for static text in production.
- **Dynamic content** (ASR transcription, TTS audio generation, transliteration of
  a user's search query) genuinely needs a live call each time, since it's unique
  per request and can't be precomputed.

---

## 3. Backend — What's Built

### `backend-py/app/services/bhashini.py`
Core service module. Exposes four async functions:
- `translate_text(text, source_lang, target_lang)`
- `transliterate_text(text, source_lang, target_lang)`
- `text_to_speech(text, source_lang, gender)` → returns audio
- `speech_to_text(audio_bytes, source_lang)` → returns transcribed text

Each function:
1. Calls Bhashini's **config/discovery** endpoint (`getModelsPipeline`) to get the
   correct `serviceId` for the requested language pair — never hardcoded, since
   available models can change.
2. Uses a shared helper, `_find_matching_service()`, to correctly pick the matching
   language entry from the config response (fixes a real bug we hit: blindly
   grabbing index `[0]` sometimes returns the wrong language's service ID when
   Bhashini returns multiple language configs in one response, e.g. for TTS).
3. Calls Bhashini's **inference** endpoint with that `serviceId`, using the
   inference API key dynamically returned by the config call (never hardcoded).
4. Checks the HTTP status code before parsing the response, and surfaces
   Bhashini's raw error text on failure instead of crashing with a generic
   `NoneType`/`KeyError` error.
5. Has retry logic with short backoff for transient failures.

**Config/credentials:** `.env` holds `ULCA_USER_ID` and `ULCA_API_KEY`
(the two Bhashini dashboard keys — "Udyat" key and inference key). Never commit
these to git; `.env` is gitignored.

### `backend-py/app/routers/multilingual.py`
FastAPI routes exposing the above functions over HTTP. Also includes:
- `GET /api/v1/multilingual/ui-text/{lang}` — returns the full cached
  `ui_strings_<lang>.json` for a given language (falls back to English if the
  language file doesn't exist). This is what the frontend calls on every language
  switch — it's a static file read, not a Bhashini call.

### `backend-py/static/ui_strings_<lang>.json` (11 files)
One JSON file per supported language (`en`, `hi`, `bn`, `gu`, `kn`, `ml`, `mr`,
`or`, `pa`, `ta`, `te`), each a flat key-value map:
```json
{
  "landing.hero.headlineLine1": "Every Detail About Your Land.",
  "footer.quickLinks": "Quick Links",
  ...
}
```
Currently **694 keys** per language, fully translated and cached.

### `backend-py/scripts/batch_translate_ui.py`
The one-time (well — run-as-needed) batch script that generates the above JSON
files. It:
- Reads `ui_strings_en.json` as the source of truth (English keys/values).
- For each of the 10 non-English target languages, translates every key using
  `translate_text()` from `bhashini.py`.
- **Skips any key that already has a cached translation** in the target file —
  so re-running it after adding new keys only translates what's new, not
  everything from scratch.
- Adds a 0.4s delay between calls to avoid bursting Bhashini's API.
- Logs progress and a final summary (translated / skipped / failed counts).

---

## 4. Language Coverage — What Actually Works

We ran a coverage check against all 22 scheduled Indian languages and confirmed
what our Bhashini account actually supports (not every language has every service
available):

| Service | Supported languages |
|---|---|
| **Translation (NMT)** | 21 of 22 (all except Konkani) |
| **TTS** | `as, bn, brx, gu, hi, kn, ml, mni, mr, or, pa, ta, te` (13 languages) |
| **ASR** | `bn, gu, hi, kn, ml, mr, or, pa, sa, ta, te, ur` (12 languages) |
| **All three (NMT+ASR+TTS)** | `bn, gu, hi, kn, ml, mr, or, pa, ta, te` (10 languages) |

**We currently ship 11 languages in the UI** (English + the 10 that have full
NMT+ASR+TTS coverage) — this was a deliberate choice so every language in the
dropdown has consistent feature support, rather than some languages supporting
voice features and others not.

---

## 5. Frontend — What's Built

### `frontend/src/context/LanguageContext.tsx`
React Context providing app-wide language state:
- `currentLang` — the currently selected language code (default `"en"`)
- `uiText` — the loaded translation map for the current language
- `setLanguage(lang)` — switches language: updates state, persists to
  `localStorage` (key: `bhoomisetu_lang`), and fetches the cached UI text from
  `/api/v1/multilingual/ui-text/{lang}`
- `t(key)` — the translation lookup function, returns `uiText[key]` or falls back
  to the raw key if not found (never crashes on a missing key)
- On app load, reads the saved language from `localStorage` (defaults to English)

Wrapped around the whole app in `frontend/src/main.tsx`.

### Language dropdown
Lives in the top navigation strip (App.tsx), and is wired via `currentLang` /
`setLanguage` from the context above. Shows all 11 supported languages with
native-script labels (e.g. "हिंदी (Hindi)").

---

## 6. The react-i18next → LanguageContext Migration

**Why we migrated:** The codebase originally used `react-i18next`, a library that
requires manually maintained translation JSON files per language, written by
hand. This conflicted with our Bhashini-based approach (real translation via API,
cached automatically) and having two competing translation systems side-by-side
would mean double maintenance forever. We removed `react-i18next` usage entirely
in favor of our own `LanguageContext`, which has the same `t(key)` calling
convention so most components needed only an import change.

**What changed, file by file:**
- **50+ component/page files** had their import changed from
  `useTranslation` (from `'react-i18next'`) to `useTranslation` (from our
  `LanguageContext`). In almost all cases, existing `t('some.key')` call sites
  did **not** need to change — same function signature, same key format.
- Files that had their **own local language dropdown** (`App.tsx`, `LoginPage.tsx`,
  `RegisterPage.tsx`) had their dropdown logic rewired to use `currentLang` /
  `setLanguage` from the new context instead of `i18n.changeLanguage()`.
- `BhoomiSetuLanding.tsx` (the landing page) had ~100 lines of **hardcoded**
  English/Hindi content extracted into **56 new translation keys**
  (`landing.*` namespace) added to `ui_strings_en.json`.
- **~225 additional hardcoded English strings** across 8 more files
  (`ServiceRequestForm.tsx`, `AssignedRequestsPage.tsx`, `OfficerDashboardPage.tsx`,
  `RequestsPage.tsx`, `CitizenDashboardPage.tsx`, `RaiseRequestPage.tsx`,
  `Footer.tsx`, `FeaturesPage.tsx`) that were never wrapped in any translation
  call at all were found in a manual audit and wrapped in `t()`, with new keys
  added to `ui_strings_en.json`.
- **Deliberately left untranslated** (by design, not oversight): brand/official
  names — `BhoomiSetu`, `SVAMITVA` (and variants), `ULPIN`, `Google Play`,
  `App Store`, `Get it on`, `Download on the`, and
  `Ministry of Panchayati Raj & Department of Land Resources`. These are proper
  nouns / fixed third-party branding and should never be run through translation.
- **Bug fixed during migration:** the landing page's `heroBadges`/`featureCards`/
  `workflowSteps`/`stakeholders`/`impactSectors` arrays were originally calling
  `t()` **twice** on the same value (once when building the array, once again in
  JSX), which meant translations silently broke for any non-English language.
  Fixed by removing the redundant second `t()` call in the JSX — the arrays are
  defined as plain `const` inside the component body (not memoized), so they
  correctly re-resolve on every re-render when the language changes.
- **Left alone, on purpose:** `src/i18n/config.ts` (the old i18next setup file),
  the bootstrap import in `main.tsx`, and `src/test/setup.ts` — these aren't
  causing any harm since nothing calls them anymore functionally, but they
  haven't been deleted yet. Safe cleanup for later, not urgent.

**Total scope of the migration:** 50+ files updated, ~281 new translation keys
added (56 from the landing page + ~225 from the broader audit), on top of the
~440 keys that already existed. Current total: **694 keys**, all translated
into 10 languages plus English.

---

## 7. What's Remaining

### Not yet built (frontend)
- **`SpeakerButton` component** — plays TTS audio for status messages and
  notifications. Backend (`text_to_speech()`) is tested and working; a prompt for
  building this component has been written but **not yet executed**.
- **`MicButton` component** — records voice input and fills search/request forms
  via ASR. Backend (`speech_to_text()`) is tested and working; same as above,
  prompt written, **not yet executed**.
- **Transliteration wired into search** — so typing a name/address in Roman
  letters still matches records stored in Devanagari/other scripts. Backend
  (`transliterate_text()`) works; not yet connected to the actual search UI.

### Blocked (not a code problem)
- **OCR** — the Bhashini pipeline tied to our account returns
  `"Requested pipeline does not exist with this submitter"` for OCR. This means
  our account/key isn't provisioned for OCR access. Needs a request to Bhashini
  support/dashboard team to enable it — cannot be fixed in code.
- **ALD (Audio Language Detection)** — similarly blocked; the task type we tried
  (`audio-lang-detection`) returned `"TaskType is not valid"`. The correct task
  type / account permission needs confirming with Bhashini before this can be
  built.

### Nice-to-have cleanup (non-urgent)
- Remove the unused `react-i18next` package and `src/i18n/config.ts` entirely
  once the team is confident nothing references them.
- Double-check mobile browser behavior for the mic/speaker buttons once built
  (iOS Safari has stricter autoplay/microphone permission rules than desktop
  Chrome).

---

## 8. For Teammates: How to Add a New Translatable String

If you're working on this branch and need to add new UI text (a new button,
label, message, etc.), follow this process:

### Step 1 — Add the English string
Open `backend-py/static/ui_strings_en.json` and add your new key/value pair.
Follow the existing naming convention: dot-notation, grouped by
page/feature/section, e.g.:
```json
"myNewPage.submitButton": "Submit My Form",
"myNewPage.errorMessage": "Something went wrong, please try again."
```
Keep keys descriptive and grouped logically (look at existing keys like
`officerDashboard.*`, `requestsPage.*` for the pattern to follow).

**Do not** hardcode English text directly in your component's JSX.

### Step 2 — Use the key in your component
```tsx
import { useTranslation } from '<path to>/context/LanguageContext';

function MyComponent() {
  const { t } = useTranslation();
  return <button>{t('myNewPage.submitButton')}</button>;
}
```
That's it — no need to import anything else, no need to touch any other language
file yourself.

### Step 3 — Run the batch translation script
Once your new key(s) are in `ui_strings_en.json`, someone with a working
`ULCA_API_KEY` needs to run:
```bash
export ULCA_USER_ID="..."
export ULCA_API_KEY="..."
python backend-py/scripts/batch_translate_ui.py
```
This automatically skips all previously-translated keys and only translates the
new ones you added — it will NOT re-translate the whole file, so it's fast for
small additions (a handful of new keys takes seconds, not the ~54 minutes the
full 2,247-key run took).

**Important:** if you don't have Bhashini credentials yourself, either ask
whoever owns the key to run the script after you merge your string additions,
or coordinate so new keys get added and translated together before merging to
avoid the UI showing raw key names (like `myNewPage.submitButton`) in
non-English languages until the script is run.

### Step 4 — Verify
Switch the language dropdown in the running app to a non-English language and
confirm your new text actually shows translated content, not the raw key.

### What NOT to translate
Leave these as plain hardcoded English, do not wrap in `t()`:
- The brand name `BhoomiSetu`
- Official scheme/identifier names: `SVAMITVA`, `ULPIN`
- Third-party app store badge text: `Google Play`, `App Store`, `Get it on`,
  `Download on the`
- Official government department names (e.g.
  `Ministry of Panchayati Raj & Department of Land Resources`)

### Common mistakes to avoid
- **Don't call `t()` twice on the same value.** If you're building an array of
  objects where each object holds translated text, call `t()` once when reading
  the value in JSX — not once when building the array AND once when rendering it
  (this exact bug happened on the landing page and silently broke translations).
- **Don't memoize translated content with `useMemo`/`useCallback` and an empty
  dependency array.** If translated text is cached without `currentLang` as a
  dependency, it won't update when the user switches languages.
- **Don't call Bhashini's live translation API directly from the frontend** for
  static UI text. Always go through the cached `ui_strings_<lang>.json` /
  `useTranslation()` hook. Live API calls from the frontend are reserved for
  ASR/TTS/transliteration only — genuinely dynamic, per-request content.

---

## 9. Known Issues / Gotchas (for future debugging)

- **Bhashini's config API expects `pipelineId` nested inside
  `pipelineRequestConfig`, not at the top level of the payload.** Getting this
  wrong causes a generic, unhelpful `"something went wrong"` 500 error rather
  than a clear validation error — this cost significant debugging time early on.
- **TTS/other config responses can return multiple language configs in one
  response array.** Always match on the actual `sourceLanguage`/`targetLanguage`
  fields via `_find_matching_service()` — never blindly index `[0]`, since the
  first entry isn't guaranteed to be the language you asked for.
- **Header name/value for inference calls must come from the config response**
  (`pipelineInferenceAPIEndPoint.inferenceApiKey.name`/`.value`), not hardcoded
  as `"Authorization"` — Bhashini can vary this per account/pipeline.
- **Not every language supports every service.** Always check the coverage table
  in Section 4 before assuming a language has ASR/TTS just because it has
  translation.
