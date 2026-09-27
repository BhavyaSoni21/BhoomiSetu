Yes. **3–5 minutes changes the strategy completely.** We should target **~4 minutes 30 seconds**, not try to cram every page into the video. The video needs to prove the architecture through one case, while the rest of the features appear as fast, purposeful inserts.

The core case should be:

**Citizen complaint → AI routing → Registration → Land Records → Verifier → Tax → Audit → Citizen resolution**

That demonstrates interoperability, the central PS requirement, without turning the recording into a government-office simulator.

Your architecture explicitly supports **one case producing multiple department tasks**, with each department independently reviewing/deciding, and every decision requiring a reason.

## Target video: ~4:30

| Time          | Screen / Action                                                                                | What the viewer learns                     |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **0:00–0:12** | Home/About                                                                                     | Problem + BhoomiSetu thesis                |
| **0:12–0:42** | First-time Register → OTP → Onboarding                                                         | Real citizen onboarding                    |
| **0:42–1:05** | Citizen Dashboard → Marathi → My Parcels → Hero Parcel                                         | Citizen access + multilingual              |
| **1:05–1:25** | Parcel 360 + GIS                                                                               | **One Parcel, Every Record**               |
| **1:25–2:00** | Get Assistance → AI complaint → AI routing → OCR → Submit                                      | AI + document intelligence + case creation |
| **2:00–2:40** | Registration Officer → same Case → review → **Reject + reason** → corrected evidence → Approve | Department workflow + auditability         |
| **2:40–3:15** | Land Records Officer → same Case → Parcel 360/evidence → assign verifier                       | Interoperability                           |
| **3:15–3:40** | Verifier → same Case → GPS/photo/offline evidence → submit                                     | Field verification                         |
| **3:40–4:00** | Tax Officer → same Case → review updated context → decision                                    | **Third department interoperability**      |
| **4:00–4:15** | Historical Imagery → Change Detection → Governance Alert                                       | Satellite intelligence                     |
| **4:15–4:30** | Admin Audit → Citizen My Cases                                                                 | Complete trace + citizen outcome           |

That is the video.

Not 40 screens. **One story, 40-ish seconds per major stage.**

---

# 0. Deployment alignment (verified 2026-09-25)

**Record against the live stack — it is fully wired and working:**

- **App (drive this):** https://bhoomi-setu-nine.vercel.app/
- **Backend:** https://bhoomisetu-ryh4.onrender.com/api/v1 (Render). Verified live, CORS-allows the Vercel origin, prod DB seeded.
- **Login:** demo accounts, shared password `Demo@123` (admin, 8 officers, 2 verifiers, `citizen1@example.com`). Use the Sign-In "Demo accounts" panel.
- **Recording:** screen-record the browser while walking the flow manually on the Vercel URL (any screen recorder / OS capture). The repo's `scripts/record_demo.js` Playwright auto-driver is an available hands-free alternative, but it's hardcoded to `localhost:5173` — repoint its `BASE` to the Vercel URL before use.

**⚠ Warm the backend before every shoot.** Render free tier sleeps after ~15 min idle → the first request stalls ~50s. Load the site (or hit any endpoint) ~1 min before recording and keep a tab open so it stays awake.

**Hero parcel (citizen1, verified in prod):** ULPIN `ULPIN0000120891` · canonical `CAN10518` · local `AP-VIJ-9976` · cluster `AP-VIJAYAWADA-01` · Vijayawada, AP · **Registered** (so Get Assistance / Raise Complaint is available). Use this as the constant hero parcel throughout.

**Three beats that differ from the current build — adjust before recording:**

| Script beat | Reality | Do this instead |
|---|---|---|
| 1:25 In-chat **OCR** inside Get Assistance | The Get Assistance chat has **no** OCR/upload step. OCR lives in the **parcel-linking** flow (My Parcels → + New Parcel → verify-by-document) and the SURVEY officer Documents tool. | Record OCR as a **separate clip** from parcel-linking and cut it in as the "document intelligence" insert. Don't imply it happens inside the complaint chat. |
| 1:25 AI routing = **Registration + Land Records + Tax** | Routing is **LLM-driven** (Groq), not rule-based (the deterministic intent-map is only a fallback when the LLM fails). **Live-tested 2026-09-25** against the Render backend with the exact script complaint: it lands `[LAND_RECORDS, REGISTRATION, TAX]` about **2 of 3 runs**, occasionally dropping REGISTRATION; sharper "verify my registered deed" wording made it *worse* (added SURVEY). | Use the **original** complaint (below), warm backend, and **dry-run the Get Assistance flow 1–3 times until the routing shows all three (Reg + LR + Tax)**, then record that take. Don't reword it; don't gamble on a single live run. |
| 4:15 **Audit Log** page | A dedicated **Admin → Audit Log** page now exists (`/admin/audit-log`) — the full filterable `/audit` feed (every officer/admin login + decision, by type). Case-specific step history also lives in Workflow Oversight (`WorkflowReviewPanel`). | Open **Admin → Audit Log** for the platform-wide chronological trail; optionally dip into Workflow Oversight for the case's per-step history. |

Also: the Registration reject→correction→approve loop needs the right action. **Use "Return for Review", not "Reject"** — a true REJECT completes the task terminally (can never be approved after), while **Return for Review** blocks it so it can be approved once corrected. There is no citizen "resubmit" endpoint, so stage the correction manually (citizen adds/replaces a document) between officer clips, then re-open the same task and Approve. See §6.

---

# 1. 0:00–0:12 — Opening

### Screen

Home/About.

### Narration

> “Land governance is fragmented across departments, causing inconsistent records, delays, and repeated verification. BhoomiSetu connects these records around one parcel and one trusted workflow, allowing citizens and departments to work from the same source of truth.”

Then immediately:

**Sign In**

The PPT's central message is already built around this exact framing. 

---

# 2. 0:12–0:42 — First-time citizen flow

This must be fast.

### Show

**Register**

→ Enter details

→ **Create Account**

→ **OTP**

→ **Verify**

→ Welcome

→ Language

→ Profile

→ Finish onboarding

Don't show every keystroke.

Use a prepared browser state wherever possible.

The actual application flow is:

**Register → OTP verification → citizen dashboard → onboarding wizard**. 

### Recording trick

Record this as 4 clips:

`Register`

`OTP verified`

`Profile completed`

`Dashboard`

Then edit them together.

It will look like:

**click → instant progression**

instead of watching someone type an email address like they're negotiating a peace treaty.

---

# 3. 0:42–1:05 — Citizen + multilingual + parcel

Now switch to the **prepared demo Citizen account**.

### Sequence

**Citizen Dashboard**

→ switch **English → Marathi**

→ **My Parcels**

→ select hero parcel

You should visibly capture:

* ULPIN
* parcel ID
* ownership
* status

Then:

**Parcel 360**

---

# 4. 1:05–1:25 — Parcel 360 hero moment

This gets **20 seconds**, because this is your strongest screen.

Show, quickly:

**Overview | Land Records | Registration | Planning | Tax | Restriction | Dispute | Encumbrance | Ownership History**

> These are the **actual** Parcel 360 tabs (`Parcel360View.tsx`). Note: there is **no standalone "Survey" tab** (the script's old list was slightly off); Survey data surfaces via the officer tools, not a Parcel 360 tab. The owner-only tabs (Planning, Tax, Restriction, Dispute, Encumbrance, Ownership History) are hidden for non-owner viewers — fine here since you're the owner (citizen1).

Then show the GIS parcel.

The Parcel 360 architecture is explicitly intended to aggregate those parcel-linked governance records. 

### Narration

> “Every department works on the same parcel identity. Ownership, registration, taxation, planning, restrictions, disputes and survey records are linked through the same parcel.”

Then:

**Get Assistance**

---

# 5. 1:25–2:00 — The actual complaint

This is the heart of the video.

Citizen enters:

> “My sale deed is registered, but the ownership record still shows the old owner and the tax record still has the old land area.”

Then show:

### AI understands

### AI drafts/classifies

### AI routes

We want the routing result to clearly show:

**Registration + Land Records + Tax**

### Important

Do **not** rely on a random live LLM response to decide whether it returns 1 or 3 departments during the recording.

For the demo, the case should be **preconfigured/prepared so the exact intended departments are produced**. Your architecture supports multi-department tasks and configurable workflow pipelines, while the AI routing itself can return one or more departments.

(Reality: routing is **intent/rule-based** — see §0. The seeded sample routed to Reg + LR + **Planning**, not Tax. Dry-run your chosen complaint until it produces Registration + Land Records + Tax before recording.)

Then show:

**Document intelligence (separate clip):** OCR is **not** part of the Get Assistance chat in the current build — it lives in the parcel-linking flow (My Parcels → + New Parcel → verify-by-document) and the SURVEY officer Documents tool.

**Upload document → OCR → extracted fields → match result**

Record this from the parcel-linking flow and cut it in here as the document-intelligence insert (see §0). The OCR pipeline (extraction + OpenCV tamper signal + field matching) is real — just not wired into the complaint chat.

Finally:

**Submit**

Capture:

> **Case ID: C-XXXX**
> **ULPIN: XXXXX**

That ID stays visible conceptually throughout the entire video.

---

# 6. 2:00–2:40 — Registration Officer

Switch account.

### Registration dashboard

Do not linger.

Immediately:

**Cases → same Case ID**

The officer sees:

* same citizen
* same parcel
* same complaint
* same uploaded document
* OCR output

Then:

### Return for Review

> **⚠ Backend reality — do NOT click "Reject" here.** In the decision dropdown pick **Return for Review**, not Reject. A true **REJECT** sets the task to `COMPLETED` and it is **terminal** — the same task can never be approved afterward (`resolve_task` returns `INVALID_TASK_TRANSITION` on a completed task), so it breaks the one-case reject→approve loop. **Return for Review** sets the task to `BLOCKED`, which *can* be resolved again later → APPROVE. All three actions (APPROVE / REJECT / RETURN_FOR_REVIEW) are in the officer modal dropdown; the loop only works via Return for Review.

Reason (mandatory remarks):

> “Submitted registration reference does not match the supporting document.”

This demonstrates the mandatory-reason requirement.

Then immediately show:

### Citizen/case updated

**Returned for review → correction submitted**

> There is **no citizen "resubmit" endpoint** — the correction is staged manually (citizen adds/replaces the supporting document or note). The task stays `BLOCKED` meanwhile; nothing technical is required to "unblock" it.

Then return to Registration Officer:

**Corrected evidence → Approve** (re-open the same BLOCKED task → decision APPROVE)

Reason:

> “Corrected registration document verified against submitted records.”

### Why this sequence matters

You have now demonstrated:

**AI → department → evidence → human decision → return-for-review reason → correction → approval**

That's much stronger than simply clicking "Approve."

---

# 7. 2:40–3:15 — Land Records

Switch account.

### Land Records Officer dashboard

Open:

**same Case ID**

Then quickly show:

**Registration approval already present**

→ **Parcel 360**

→ **RoR / ownership**

→ **area discrepancy**

Then:

### Assign Verifier

This establishes:

**Registration → Land Records**

without creating another case.

That is the interoperability story.

The system architecture explicitly models one case with multiple `DepartmentTask`s. 

---

# 8. 3:15–3:40 — Verifier

Switch account.

### Verifier dashboard

Show:

**same Case ID**

Open:

**Capture Evidence**

Then rapid sequence:

**GPS → Camera → Photo → Notes → Submit**

If offline is stable during recording:

show the queue briefly.

Then:

**Findings → Submit**

The documented verifier flow supports geo-tagged evidence and offline queueing/synchronization. 

This gives you the field-government side of the system.

---

# 9. 3:40–4:00 — Tax Officer

Switch account again.

### Tax Officer

Open:

**same Case ID**

Show:

* old area
* corrected area
* current tax information
* Land Records decision
* evidence

Then:

### Tax decision

Reason:

> “Parcel-area correction has been approved. Tax record requires reassessment.”

This is the third departmental handoff.

### Narration

> “The citizen created one case. Registration, Land Records and Tax now act on the same parcel and case context, without recreating the record.”

That is the sentence I would make the **interoperability headline** of the video.

Important: your documentation currently marks the full automatic cross-department propagation engine as TEAM DESIGN, so the video should demonstrate **shared case/context and departmental interoperability**, not falsely present every downstream update as an automatic trigger.

---

# 10. 4:00–4:15 — Satellite + Historical Intelligence

Now we stop following the complaint and do a **feature montage**.

### Clip 1

Officer:

**Historical Imagery**

Show:

**2025 → 2026**

> **⚠ Backend reality (verified live 2026-09-25).** Imagery exists for 2020/2022/2024/2025/2026, but the compare endpoint **only generates a governance alert for `2025 → 2026`** — any other year pair (e.g. 2020→2026) is rejected: *"Comparisons that generate governance alerts must run from 2025 to 2026."* For the change-detection → alert chain to work on camera, compare **2025 → 2026**. On the hero cluster `AP-VIJAYAWADA-01` this returns `changeDetected: true` with **22 affected parcels**. (You may still *browse* the older years' imagery for the "then vs now" visual, but run the actual Compare on 2025→2026.)

### Clip 2

**Change Detection**

Show:

**changed region → affected parcel**

### Clip 3

**Governance Alert**

Show:

**Open (Detected) → Acknowledged → Field Verified → Resolved**

> Backend status enum is `OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED` (plus `DISMISSED`). The first state is **OPEN** — the UI may show it as "Detected/Open"; the progression itself matches the script.

Your documented system explicitly connects change detection to affected parcels and governance alerts.

Only **15 seconds**.

---

# 11. 4:15–4:30 — Admin + final Citizen

## Admin

Open:

**Audit Log** (`/admin/audit-log`)

Show the dedicated audit trail — the full filterable `/audit` feed of every officer/admin login and decision across the platform. Filter by type if useful.

Then, for the case's per-step history:

**Workflow Oversight**

Show the same Case ID and its departmental tasks — the chronological step trail (`WorkflowReviewPanel`) with timestamps/reasons.

You want the viewer to see something like:

**Citizen → AI → Registration → Land Records → Verifier → Tax**

with timestamps/reasons.

Then cut to:

## Citizen → My Cases

Show:

**Resolved**

> Backend fact: when every department task completes, the case moves to status **`RESOLUTION`** (lifecycle is `CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED` — there is no literal `RESOLVED` status). The My Cases chip previously rendered the raw enum in grey because the label/colour maps only knew the old `RESOLVED/IN_PROGRESS/...` names. **Fixed 2026-09-25**: `RESOLUTION` now shows a green **"Resolved"** chip (and `ACTIVE`→"In Progress", `CREATED`→"Submitted", `FEEDBACK`→"Awaiting Feedback"). ⚠ This fix is **not deployed to Vercel yet** — same redeploy note as the Audit Log page.

Then:

**Parcel 360**

The same parcel.

The same record.

The final state.

---

# The visual logic of the whole video

The viewer should gradually learn five things:

### 0:00

**There is a fragmentation problem.**

### 1:00

**BhoomiSetu puts everything around one parcel.**

### 2:00

**One citizen request becomes one structured case.**

### 3:00

**Multiple departments act on the same case and parcel.**

### 4:15

**Every action is traceable and the citizen sees the result.**

That's the narrative arc.

---

# What NOT to show

For a 4-minute video, cut these from the main flow:

**Admin user creation**

**Department CRUD**

**Profile security placeholders**

**Every officer analytics page**

**Every map layer**

**All 8 officer dashboards individually**

**Long AI conversations**

**Long PDF generation**

**Every onboarding tour screen**

**Every static page**

They can appear in **1–2 second montage inserts** if absolutely necessary, but they don't deserve full workflow time.

---

# How to handle slow pages

Your idea here is exactly right.

Every expensive operation gets its own clip.

### Example

**Clip A**

Click:

`Change Detection`

STOP RECORDING.

Wait for it.

### Clip B

Start recording again with:

**Change Detection Result**

When edited:

> click → result

Same for:

* AI response
* OCR
* satellite imagery
* Parcel 360 if slow
* PDF generation
* GIS-heavy layers

The viewer should experience **the logical operation**, not the server's personal journey toward enlightenment.

---

# The key data that must remain identical

Before recording, prepare these exactly:

| Data                  | Must stay constant              |
| --------------------- | ------------------------------- |
| Citizen               | citizen1@example.com (Demo@123) |
| Hero parcel           | CAN10518 / local AP-VIJ-9976 (Vijayawada, Registered) |
| ULPIN                 | ULPIN0000120891                 |
| Case ID               | Same                            |
| Complaint             | Same                            |
| Uploaded document     | Same                            |
| Registration decision | Rejected → corrected → approved |
| Land Records task     | Same case                       |
| Verifier task         | Same case                       |
| Tax task              | Same case                       |
| Final result          | Same case/parcel                |

This consistency is what will make the video feel like **one live government process** rather than a collection of prerecorded feature clips.

---

# One final design decision

I would target **4:20–4:40**, not the full 5 minutes.

That gives you breathing room for:

* transitions
* login waits
* one unexpected loading moment
* title cards
* final branding

And the final narrative becomes:

> **Problem**
> ↓
> **First-time Citizen**
> ↓
> **Multilingual Access**
> ↓
> **One Parcel / Parcel 360**
> ↓
> **AI Complaint + OCR**
> ↓
> **One Case**
> ↓
> **Registration**
> ↓
> **Land Records**
> ↓
> **Verifier**
> ↓
> **Tax**
> ↓
> **GIS + Satellite Intelligence**
> ↓
> **Audit Trail**
> ↓
> **Citizen Resolution**

That is the 3–5 minute version I would use. It covers the **PS requirements, the PPT's core claims, the unique features, and the interoperability thesis** without sacrificing the most important thing: the viewer always knows **which parcel and which case they're looking at**.  
