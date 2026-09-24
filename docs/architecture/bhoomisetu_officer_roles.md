# BhoomiSetu — Officer Roles: Detailed Workflow & Unique Value-Add

## Verdict on Your 7 Officer Roles

**Keep them as-is — don't change the list.** Here's why each one maps directly to a real gap named in the problem statement:

| Your Officer | Real-world equivalent | PS pain point it solves |
|---|---|---|
| **Land Record Officer** | Talathi / Tehsildar (RoR, 7/12, mutation) | "Cadastral maps, Record of Rights... managed independently" |
| **Registration Officer** | Sub-Registrar (IGR department) | "Registration records" |
| **Planning Officer** | Town Planning / Master Plan authority | "Land use information, Master Plan, Building Permission" |
| **Tax Officer** | Revenue/Municipal tax dept | "Property taxation records" |
| **Restriction Officer** | Collector's office (ceiling, forest, government land flags) | "Restrictions" |
| **Encumbrance Officer** | Sub-Registrar's encumbrance wing | "Utility infrastructure / other land-related databases" (loans, mortgages, liens) |
| **Dispute Officer** | Tehsildar's Revenue Court function | Not explicitly named in PS, but essential — this is your **operational glue** connecting citizen complaints across all the above |
| **Survey Officer** | District Survey Office / Survey & Settlement Department | "Cadastral maps... managed independently" — physical measurement & GIS geometry corrections |

This 7-way split is actually a strong answer to the PS's core complaint: *"land governance involves multiple institutions maintaining information in fragmented, disconnected systems."*

You've modeled each fragment as its own role instead of pretending it's all one department — which is more realistic and more defensible to evaluators than a single generic "Officer" role.

### Optional Addition to Consider

**Not required:** A **Survey Officer** role for physical measurement/GIS corrections. Currently this might sit inside "Land Record Officer," which is fine for a prototype, but call this out explicitly if an evaluator asks **"who updates the map geometry itself?"**

---

# Detailed Workflow — What Each Officer Actually Does

## 1. Land Record Officer (`landrecords.officer@`)

**Real-world job:** Maintains RoR (7/12/8A), approves mutations, verifies ownership.

### Workflow

1. **Login → Dashboard shows queue:** pending mutation requests, name/area correction requests (from your OCR verification flow).
2. **Opens a request →** sees the AI-generated structured message + attached proof + OCR match score.
3. **Cross-checks** against the current RoR entry in the system.
4. **Actions available:**
   - **Approve** (updates RoR, triggers new parcel version + audit entry)
   - **Reject with reason**
   - **Send back for more info**
5. **On approval,** the citizen's parcel status flips from **"Pending Verification" → "Registered"** (this is the exact gate you built for Raise Complaint).

### Unique BhoomiSetu Solution

Instead of the officer manually re-typing/re-checking data from a scanned document, they see the **OCR-extracted fields side-by-side with citizen-typed fields and a match %**, cutting manual verification time from a full site/file/record check to a quick confirm-or-flag decision.

---

## 2. Registration Officer (`registration.officer@`)

**Real-world job:** Handles sale deed registration, links registered documents to the RoR update chain.

### Workflow

1. **Queue:** pending registration-linked requests (e.g., *"my sale deed isn't reflected in the record"*).
2. **Verifies** the registered document reference (registration number, date, parties) against uploaded proof.
3. **Confirms →** sends a linking signal to the Land Record Officer's queue so mutation can proceed.  
   Registration and mutation are legally separate steps — your system should model this handoff explicitly, not merge them.
4. **Can flag** suspected duplicate/conflicting registrations on the same survey number.

### Unique BhoomiSetu Solution

**Automatic duplicate-registration flagging** — when a new registration references a survey number that already has an active registered owner, the system flags it **before the officer even opens the file**, instead of relying on the officer to remember/cross-check manually.

---

## 3. Planning Officer (`planning.officer@`)

**Real-world job:** Manages land-use classification, Master Plan zoning, building permissions.

### Workflow

1. **Queue:** building permission requests, land-use change requests, zoning queries.
2. **Checks the parcel against the Master Plan layer (GIS zoning overlay)** — is the requested use allowed in this zone?
3. **Approves/rejects with a zoning-compliance note;** if approved, updates the parcel's land-use attribute.

### Unique BhoomiSetu Solution

Because parcels are **geometry-linked** (not just text records), the officer sees an **automatic zoning-conflict check** — the system visually overlays the parcel on the zoning map and highlights **(in red)** if the requested use doesn't match the zone, before manual review even starts.

---

## 4. Dispute Officer (`dispute.officer@`)

**Real-world job:** Tehsildar-equivalent revenue court function — hears boundary disputes, ownership conflicts, encroachment complaints.

### Workflow

1. **Queue:** complaints classified as **"Dispute Filing"** (via your AI classification/"Describe My Issue" flow).
2. **Reviews** the structured message, attached proof, and — if physical verification was triggered — the field verifier's GPS-tagged photo evidence.
3. **Can escalate** to Collector-level review for unresolved/high-value disputes (mirrors the real SDO → Collector → Commissioner appeal chain).
4. **Final ruling recorded with reasoning,** visible to the citizen via status tracking.

### Unique BhoomiSetu Solution

The **evidence chain is pre-assembled before the officer even opens the case** — citizen's complaint, OCR-verified document, field verifier's geo-tagged photos, and any prior rejected/claim history on that survey number, all in one view — instead of the officer chasing paperwork across departments.

---

## 5. Tax Officer (`tax.officer@`)

**Real-world job:** Manages land revenue/property tax assessment and payment records.

### Workflow

1. **Queue:** tax dispute requests (*"my assessment is wrong"*), reassessment requests after mutation.
2. **Checks** parcel area/classification (agricultural vs non-agricultural — tax rates differ) against the current RoR.
3. **Updates assessment,** generates/updates the tax record tied to the parcel.

### Unique BhoomiSetu Solution

Tax reassessment is **auto-triggered** when the Land Record Officer approves a mutation with a changed area/classification, instead of requiring the citizen to separately file a tax update request — one verified change propagates across departments.

---

## 6. Restriction Officer (`restriction.officer@`)

**Real-world job:** Manages statutory restrictions — ceiling-act land, forest land, government/gairan land, prohibited-transfer flags.

### Workflow

1. **Queue:** requests to add/remove/verify a restriction flag on a parcel (e.g., a citizen disputing that their land is wrongly flagged as restricted).
2. **Cross-checks** against the restriction source record (forest department notification, ceiling act order, etc. — as an uploaded reference document).
3. **Approves/rejects the flag change;** this directly affects whether that parcel is transferable/mortgageable elsewhere in the system.

### Unique BhoomiSetu Solution

Restriction flags are **enforced at the data layer**, not just displayed — if a parcel has an active restriction, the system automatically blocks/warns on registration or encumbrance actions elsewhere in the platform, so a restricted parcel can't accidentally get registered or mortgaged through a different officer's queue.

---

## 7. Encumbrance Officer (`encumbrance.officer@`)

**Real-world job:** Maintains records of loans, mortgages, and liens registered against a parcel (encumbrance certificate).

### Workflow

1. **Queue:** encumbrance certificate requests, new-loan/mortgage registration entries from banks (e.g., Kisan Credit Card loans against land).
2. **Verifies** the parcel is not already over-leveraged or under an active dispute/restriction before approving a new encumbrance entry.
3. **Issues** the encumbrance certificate (PDF) or updates the encumbrance ledger for that parcel.

### Unique BhoomiSetu Solution

Because encumbrance, dispute, and restriction data live on the **same unified parcel record** (not separate silos), the officer automatically sees if a parcel under dispute or restriction is being used for a new loan application — preventing exactly the kind of fraud (mortgaging disputed/restricted land) that fragmented systems allow today.

---

## 8. Survey Officer (`survey.officer@`)

**Real-world job:** District Survey Office / Survey & Settlement Department — conducts physical field measurements, updates cadastral map geometry, resolves boundary demarcation disputes, maintains the spatial integrity of the cadastral layer.

### Workflow

1. **Queue:** survey measurement requests (citizen-initiated boundary verification, mutation-linked area corrections, court-ordered demarcation, GIS geometry correction flags from change detection).
2. **Reviews** the request with parcel's current geometry (GIS overlay), RoR area, and any prior survey records or disputed boundary evidence.
3. **Conducts/validates field measurement** — captures GPS/GNSS coordinates, total station readings, or drone imagery; uploads geo-tagged field notes and measurement sketches.
4. **Updates parcel geometry** — if measurements confirm a discrepancy, approves the corrected polygon (triggers new parcel version + audit entry); if measurements match existing geometry, closes request with "no change" finding.
5. **Cross-department sync** — on geometry/area change, automatically notifies Land Record Officer (RoR area update), Tax Officer (reassessment trigger), and Planning Officer (zoning boundary check).

### Unique BhoomiSetu Solution

**GIS geometry corrections are first-class, auditable workflows** — instead of ad-hoc map edits by any officer, the Survey Officer owns the spatial integrity gate. The system provides:
- Side-by-side overlay of current vs. measured geometry with area delta
- Measurement evidence chain (GPS logs, photos, field notes) attached to the parcel
- Automatic propagation of area changes to RoR, Tax, and Planning — no manual re-entry across departments
- Dispute Officer can directly request Survey measurement for boundary disputes, closing the loop between legal adjudication and physical ground truth

---

# The One Line That Ties All 8 Together (for your demo)

> **"Each officer only sees their department's slice of work — but every action they take writes back to one shared parcel record, so a mutation approval automatically updates tax liability, a restriction flag automatically blocks encumbrance registration, a dispute automatically pauses any pending registration on that same survey number, and a survey measurement correction automatically propagates area changes to RoR, Tax, and Planning. That cross-department consistency is the actual problem statement — not any single officer's dashboard."**
