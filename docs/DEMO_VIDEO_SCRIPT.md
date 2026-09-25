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

**Ownership | Registration | Tax | Planning | Restrictions | Encumbrance | Dispute | Survey | History**

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

Then show:

**Upload Sale Deed → OCR → extracted fields → match result**

Your documented OCR pipeline specifically supports OCR extraction, OpenCV tamper signal and field matching before officer review. 

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

### Reject

Reason:

> “Submitted registration reference does not match the supporting document.”

This demonstrates the mandatory-reason requirement. 

Then immediately show:

### Citizen/case updated

**Rejected → correction submitted**

Then return to Registration Officer:

**Corrected evidence → Approve**

Reason:

> “Corrected registration document verified against submitted records.”

### Why this sequence matters

You have now demonstrated:

**AI → department → evidence → human decision → rejection reason → correction → approval**

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

**2020 → 2026**

### Clip 2

**Change Detection**

Show:

**changed region → affected parcel**

### Clip 3

**Governance Alert**

Show:

**Detected → Acknowledged → Field Verified → Resolved**

Your documented system explicitly connects change detection to affected parcels and governance alerts. 

Only **15 seconds**.

---

# 11. 4:15–4:30 — Admin + final Citizen

## Admin

Open:

**Workflow Oversight**

Show the same Case ID and its departmental tasks.

Then:

**Audit Log**

Show the chronological trail.

You want the viewer to see something like:

**Citizen → AI → Registration → Land Records → Verifier → Tax**

with timestamps/reasons.

Then cut to:

## Citizen → My Cases

Show:

**Resolved**

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
| Citizen               | Same demo citizen               |
| Hero parcel           | Same parcel                     |
| ULPIN                 | Same                            |
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
