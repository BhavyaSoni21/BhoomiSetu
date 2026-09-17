# BhoomiSetu Official Document Generation — Code Review and Implementation Blueprint

## Review scope

This review covers `backend-py/app/common/parcel_generation/official_document_generator.py` and the complete data path that supplies it: `land_record_pdf_service.py`, the parcel route/service, the React Parcel 360 screen, the PDF/image viewing behavior, seed data, and existing tests.

The intended behavior is:

1. Build an official land-record PDF from the selected parcel and related database/profile records.
2. Show the generated document in a dedicated viewer when **View** is clicked.
3. Allow browser download when **Download** is clicked.
4. Allow zooming while viewing.
5. Have deterministic fixtures that prove real values, not merely that the output begins with `%PDF-`.

## Executive summary

The PDF renderer is structurally sound as a pure ReportLab formatter, but the end-to-end implementation is incomplete. The current generator does not query data, and the assembler does not receive the authenticated user or read the user profile. The UI has a download action only; it has no official-PDF view action and therefore no PDF zoom flow. Existing tests verify PDF signatures but do not verify that profile, parcel, ownership, mutation, tax, crop, and workflow values are present in the produced document.

The most likely reason a PDF appears empty is not ReportLab itself. It is the data contract between the database assembler and the renderer: missing or unseeded related rows become `None`, empty arrays, or fallback labels, while the tests still pass because they only assert that a PDF file was emitted.

## Verdict

**Request Changes.** Do not merge the current implementation as the completed feature. The renderer can remain, but the data contract, profile sourcing, view modal, and integration tests need to be added.

## Findings by priority

### Critical findings

#### C1 — Tests do not prove that values are rendered

**Locations:** `backend-py/tests/common/test_official_document_generator.py:43-90`

Every test only checks `pdf_bytes[:5] == b"%PDF-"`. A blank or almost entirely fallback PDF is therefore considered successful. This is the central test gap.

**Required correction:** extract text from the generated PDF with `pypdf`/`pdftotext` and assert representative values such as the owner name, survey number, ULPIN, village, mutation number, tax assessment, and crop name.

#### C2 — The PDF assembler never reads the authenticated profile

**Location:** `backend-py/app/services/land_record_pdf_service.py:126-249`

`build_land_record_pdf_data(db, parcel)` accepts only a database session and parcel. It can read parcel, ownership, tax, crop, registration, and workflow rows, but it cannot read the current user's profile. The `User` model contains `name`, `email`, `mobile_number`, `address`, `government_id_number`, and `occupation`, yet none of these are part of `LandRecordPDFData`.

**Required correction:** pass the authenticated `User` into the assembler and add an explicit `ProfileInfo` value object to the PDF data contract. Do not silently substitute a workflow creator for the profile owner.

#### C3 — There is no official-PDF View action

**Location:** `frontend/src/features/parcels/Parcel360View.tsx:139-155, 284-293`

The screen only has a `Download Official Document` button. The existing `ImageLightbox` is for stored image documents and is not connected to the generated PDF endpoint. A user cannot click View, inspect the generated PDF, or zoom it inside the application.

**Required correction:** add a `View Official Document` action that fetches the authenticated PDF as a blob, creates a managed object URL, opens a modal containing an iframe/embed PDF viewer, and revokes the URL on close.

#### C4 — The active backend/API boundary must be confirmed

This archive contains a TypeScript backend and a Python backend. The official PDF route reviewed here is in `backend-py/app/routers/parcels.py:159-171`, while the frontend calls `/parcels/:id/documents/official-pdf`. The deployment must route that path to the Python service that contains the assembler and ReportLab renderer. If the frontend is pointed at the TypeScript service instead, changes to the Python generator will not affect the running website.

**Required correction:** document and test the deployment target. In local development, proxy `/api/v1` to `backend-py`; in production, route the same API prefix to the Python service.

### Major findings

#### M1 — Profile and related values need an explicit source policy

The document currently mixes data from several unrelated sources without a documented priority order. For example, ownership falls back to `land_records_lookup_service`, while the applicant strip uses the latest approved workflow creator. These can describe different people.

Use this source policy:

| Document value | Primary source | Fallback | Never do |
|---|---|---|---|
| Profile name/contact | authenticated `User` profile | parcel current owner only for staff-generated records | Use workflow creator as profile owner without labeling it |
| Village/taluka/district | parcel/cluster metadata | `not_available` | Invent a location |
| Survey/plot/ULPIN | `ParcelIdentifier` and `Parcel` | `not_available` | Pick an arbitrary identifier |
| Current/previous owners | `OwnershipHistoryRecord` | adapted land-record result | Treat a missing history as a database error |
| Assessment | `TaxRecord.assessed_value` | `not_available` | Render zero for missing data |
| Applicant/application | approved workflow | omit the strip | Fabricate approval data |
| Crops | `CropRecord` | explicit “No crop data” row | Invent a crop |

#### M2 — The assembler performs several independent queries and has no integration assertion

The service performs queries for identifiers, registration, tax, workflows, ownership, and crops. That is acceptable at this scale, but the lack of an integration fixture means field-name drift can silently generate fallback values.

Add a database-backed test that inserts all related rows and calls the route. Assert both HTTP headers and extracted PDF content.

#### M3 — PDF layout can overflow when ownership/crop history grows

`render_official_document_pdf` draws both tables on a single A4 page and does not check whether `y - th` becomes negative. Multiple owners and crops can overlap the footer or fall off the page. The existing multiple-row test does not inspect page layout.

Use Platypus `SimpleDocTemplate`/`PageTemplate` for multi-page flowables, or at minimum call `showPage()` when the next table cannot fit. Add a test with enough rows to assert that the PDF has more than one page and contains all rows.

#### M4 — The browser object URL is revoked immediately after `link.click()`

**Location:** `Parcel360View.tsx:149-155`

Many browsers handle this sequence, but immediate revocation is brittle and makes the same helper unsuitable for a viewer. Centralize blob URL lifecycle in a hook or helper and revoke after the viewer closes; for downloads, revoke on a short timeout.

#### M5 — No visible error state exists for PDF generation

The download mutation disables the button while loading, but there is no user-visible message when the endpoint returns 403, 404, 500, or an invalid blob. Add an error message and reset it when the selected parcel changes.

### Minor findings

1. `ParcelInfo.area_sq_m` is assembled but is not displayed in the visible PDF body. Add an area row so a user can verify the value.
2. `village_name` is derived from the cluster's district display value. The code comments acknowledge that this is a cluster-level approximation. Rename the displayed label or add a real village field before using this as an official legal document.
3. The renderer's emblem is text (`Go{state_code}`), not a real government emblem. Keep it as a development placeholder only and inject the approved asset before production use.
4. `generated_at` uses a naive local datetime by default. Use a timezone-aware UTC timestamp and format it consistently for the configured jurisdiction.
5. Hindi support exists in the renderer, but the tests only verify the PDF signature. Add a text/content assertion using a Hindi-capable font or verify font embedding and page rendering separately.

## Positive feedback

The implementation has several good foundations:

- `official_document_generator.py` is correctly separated from database access. A pure renderer is easier to test and safer than querying inside the drawing code.
- The data classes make the intended PDF contract visible.
- SQLAlchemy queries use parameterized ORM expressions rather than string-built SQL.
- Citizen access checks are present on the official PDF route.
- The existing `ImageLightbox` already establishes a reusable interaction pattern for full-screen zoom, close controls, wheel zoom, and accessibility attributes.
- The renderer escapes table/text content through ReportLab paragraph objects rather than interpolating unescaped SVG/XML.
- The route supports English and Hindi with a constrained query parameter.

## Recommended backend implementation

### 1. Extend the PDF data contract

Add the following value object in `land_record_pdf_service.py`:

```python
@dataclass
class ProfileInfo:
    name: str | None
    email: str | None
    mobile_number: str | None
    address: str | None
    government_id_number: str | None
    occupation: str | None
```

Add it to the root data object:

```python
@dataclass
class LandRecordPDFData:
    profile: ProfileInfo | None
    applicant: ApplicantInfo | None
    parcel: ParcelInfo
    ownership: list[OwnershipRow] = field(default_factory=list)
    mutation: MutationInfo = field(default_factory=lambda: MutationInfo(False, None, None))
    crops: list[CropRow] = field(default_factory=list)
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
```

Import `timezone` and make the default timestamp timezone-aware.

### 2. Pass the authenticated user through the service boundary

Change the assembler signature:

```python
def build_land_record_pdf_data(
    db: Session,
    parcel: Parcel,
    user: User | None = None,
) -> LandRecordPDFData:
    profile = None
    if user is not None:
        profile = ProfileInfo(
            name=user.name,
            email=user.email,
            mobile_number=user.mobile_number,
            address=user.address,
            government_id_number=user.government_id_number,
            occupation=user.occupation,
        )
    ...
    return LandRecordPDFData(
        profile=profile,
        applicant=applicant,
        parcel=parcel_info,
        ownership=ownership_rows,
        mutation=mutation,
        crops=crop_rows,
    )
```

Do not expose a full government ID by default. Mask it in the document, for example `••••••1234`, unless the product's authorization policy explicitly permits the full value.

### 3. Pass the user from the route/service

Change the service:

```python
def get_official_document_pdf(
    db: Session,
    parcel_id: str,
    lang: str,
    user: User | None = None,
) -> bytes | None:
    parcel = find_one(db, parcel_id)
    if parcel is None:
        return None
    data = build_land_record_pdf_data(db, parcel, user=user)
    return render_official_document_pdf(data, lang)
```

Change the route call:

```python
pdf_bytes = service.get_official_document_pdf(
    db,
    str(id),
    lang,
    user=user,
)
return Response(
    content=pdf_bytes,
    media_type="application/pdf",
    headers={
        "Content-Disposition": f'inline; filename="record-of-rights-{id}.pdf"',
        "Cache-Control": "private, no-store",
    },
)
```

`inline` supports the View flow. The frontend can still force a download by using an anchor with a `download` attribute.

### 4. Render profile data intentionally

Add a compact profile block after the document heading. Keep it clearly labeled as applicant/viewer profile data, not as proof of title:

```python
if data.profile:
    c.setFont(font_b, 8)
    c.drawString(margin, y, t["profile_section"])
    y -= 11
    c.setFont(font, 7)
    c.drawString(margin, y, f"{t['profile_name']}: {data.profile.name or t['not_available']}")
    c.drawRightString(width - margin, y, f"{t['profile_contact']}: {_profile_contact(data.profile, t)}")
    y -= 10
    c.drawString(margin, y, f"{t['profile_occupation']}: {data.profile.occupation or t['not_available']}")
    c.drawRightString(width - margin, y, f"{t['profile_address']}: {data.profile.address or t['not_available']}")
    y -= 14
```

Do not label this block “Owner” unless the value came from an ownership record. Use “Account profile” or “Applicant profile”.

### 5. Make layout multi-page safe

The preferred correction is to migrate the page composition to ReportLab Platypus flowables. If retaining the canvas approach, add a helper:

```python
def _ensure_space(c: canvas.Canvas, y: float, required: float, margin: float, height: float) -> float:
    if y - required < margin:
        c.showPage()
        return height - margin
    return y
```

Call it before each table and footer block. Add a page number footer to every page.

## Recommended frontend implementation

Create `frontend/src/features/parcels/OfficialPdfViewerModal.tsx`:

```tsx
import React from 'react';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';

interface OfficialPdfViewerModalProps {
  url: string;
  fileName: string;
  onClose: () => void;
}

const OfficialPdfViewerModal: React.FC<OfficialPdfViewerModalProps> = ({ url, fileName, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Official document viewer">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden border-2 border-ink bg-surface shadow-hard-md">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink p-3">
          <h2 className="font-display text-sm font-black uppercase tracking-wider">Official document</h2>
          <div className="flex gap-2">
            <a
              href={url}
              download={fileName}
              className="inline-flex items-center gap-2 border-2 border-ink px-3 py-2 text-xs font-bold uppercase"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Download
            </a>
            <button onClick={onClose} aria-label="Close document viewer" className="border-2 border-ink px-3 py-2">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <iframe
          title="Official land record PDF"
          src={`${url}#view=FitH&toolbar=1&navpanes=0`}
          className="min-h-0 flex-1 bg-neutral-700"
        />
      </div>
    </div>
  );
};

export default OfficialPdfViewerModal;
```

The browser's built-in PDF viewer provides zoom controls. If identical cross-browser zoom behavior is required, use `pdfjs-dist` and render pages to canvases; do not reuse `ImageLightbox` for a PDF blob.

In `Parcel360View.tsx`, keep separate state for viewing and downloading:

```tsx
const [officialPdfUrl, setOfficialPdfUrl] = useState<string | null>(null);
const [officialPdfError, setOfficialPdfError] = useState<string | null>(null);

const fetchOfficialPdf = async () => {
  setOfficialPdfError(null);
  const lang = currentLang === 'hi' ? 'hi' : 'en';
  const response = await apiService.get(`/parcels/${id}/documents/official-pdf`, {
    params: { lang },
    responseType: 'blob',
  });
  const contentType = response.headers['content-type'] ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('The server did not return a PDF document');
  }
  const nextUrl = URL.createObjectURL(response.data as Blob);
  setOfficialPdfUrl((previous) => {
    if (previous) URL.revokeObjectURL(previous);
    return nextUrl;
  });
};

const closeOfficialPdf = () => {
  setOfficialPdfUrl((previous) => {
    if (previous) URL.revokeObjectURL(previous);
    return null;
  });
};

useEffect(() => closeOfficialPdf, [id]);
```

Add two buttons:

```tsx
<button onClick={() => fetchOfficialPdf().catch(() => setOfficialPdfError('Unable to generate the official document.'))}>
  View Official Document
</button>
<button onClick={() => downloadPdfMutation.mutate()}>
  Download Official Document
</button>
```

Render the modal near the root of the component:

```tsx
{officialPdfUrl && (
  <OfficialPdfViewerModal
    url={officialPdfUrl}
    fileName={`record-of-rights-${id}.pdf`}
    onClose={closeOfficialPdf}
  />
)}
{officialPdfError && <p role="alert">{officialPdfError}</p>}
```

## Complete backend fixture contract

The following fixture represents the minimum useful end-to-end document, not merely a syntactically valid PDF.

### User/profile fixture

```python
@pytest.fixture
def profile_user(db):
    user = User(
        id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        name="Asha Rao",
        email="asha.rao@example.test",
        mobile_number="+919876543210",
        address="12 Survey Road, Pune, Maharashtra",
        government_id_number="MH-TEST-123456",
        occupation="Agriculturist",
        role="CITIZEN",
        password_hash="not-used-in-this-test",
        email_verified=True,
        mobile_verified=True,
    )
    db.add(user)
    db.flush()
    return user
```

### Parcel and identifier fixture

```python
@pytest.fixture
def official_parcel(db):
    parcel = Parcel(
        id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        canonical_parcel_id="MH-PUN-000142",
        cluster_id="PUNE_01",
        district_code="PUN",
        state_code="MH",
        ulpin="ULPIN-MH-PUN-000142",
        area_sq_m=2310.5,
    )
    db.add(parcel)
    db.flush()
    db.add_all([
        ParcelIdentifier(parcel_id=str(parcel.id), identifier_type="SURVEY_NUMBER", identifier_value="142"),
        ParcelIdentifier(parcel_id=str(parcel.id), identifier_type="PLOT_NUMBER", identifier_value="7-A"),
    ])
    db.flush()
    return parcel
```

Adjust constructor fields to the exact current `Parcel` model if the schema has additional non-null columns. The values above are the semantic fixture contract.

### Related record fixtures

```python
@pytest.fixture
def official_related_rows(db, official_parcel, profile_user):
    parcel_id = str(official_parcel.id)
    db.add(RegistrationRecord(
        parcel_id=parcel_id,
        registration_status="REGISTERED",
    ))
    db.add(TaxRecord(
        parcel_id=parcel_id,
        assessed_value=45000.0,
    ))
    db.add(OwnershipHistoryRecord(
        parcel_id=parcel_id,
        owner_name="Asha Rao",
        khata_number="1099",
        transaction_type="ORIGINAL",
        transaction_date=date(2011, 4, 22),
        document_reference="DEED-287245",
    ))
    db.add(CropRecord(
        parcel_id=parcel_id,
        agricultural_year="2025-26",
        season="KHARIF",
        crop_type="FOOD_CROP",
        crop_name="Paddy (Rice)",
        irrigated_area_sq_m=1500.0,
        unirrigated_area_sq_m=810.5,
        irrigation_source="WELL",
        uncultivable_area_sq_m=0.0,
        remark="Demo crop record",
    ))
    db.flush()
    return profile_user
```

### Approved workflow fixture

```python
@pytest.fixture
def approved_workflow(db, official_parcel, profile_user):
    workflow = Workflow(
        id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
        parcel_id=str(official_parcel.id),
        workflow_type="ROR_COPY_REQUEST",
        current_status="APPROVED",
        created_by="Asha Rao",
        created_at=datetime(2026, 1, 10),
    )
    db.add(workflow)
    db.flush()
    db.add(WorkflowStep(
        workflow_id=workflow.id,
        action="APPROVE",
        assigned_role="LAND_RECORD_OFFICER",
        completed_at=datetime(2026, 1, 15),
    ))
    db.flush()
    return workflow
```

## Required backend tests

### Renderer content test

Install `pypdf` in the Python test requirements, then add:

```python
from io import BytesIO
from pypdf import PdfReader


def pdf_text(pdf_bytes: bytes) -> str:
    return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf_bytes)).pages)


def test_render_official_document_contains_real_values():
    pdf_bytes = render_official_document_pdf(_data(), lang="en")
    text = pdf_text(pdf_bytes)

    assert "Asha Rao" in text
    assert "142" in text
    assert "ULPIN123" in text
    assert "DEED-287245" in text
    assert "Paddy (Rice)" in text
    assert "45,000.00" in text
```

### Assembler test

```python
def test_build_pdf_data_uses_profile_and_related_rows(
    db, official_parcel, official_related_rows, approved_workflow
):
    data = build_land_record_pdf_data(db, official_parcel, user=official_related_rows)

    assert data.profile.name == "Asha Rao"
    assert data.profile.address == "12 Survey Road, Pune, Maharashtra"
    assert data.parcel.survey_number == "142"
    assert data.parcel.plot_number == "7-A"
    assert data.ownership[0].owner_name == "Asha Rao"
    assert data.ownership[0].khata_number == "1099"
    assert data.mutation.latest_mutation_no == "DEED-287245"
    assert data.crops[0].crop_name == "Paddy (Rice)"
    assert data.applicant.application_no == "33333333"
```

### Route integration test

```python
def test_official_pdf_route_returns_populated_private_pdf(
    client, official_parcel, official_related_rows, citizen_headers
):
    response = client.get(
        f"/api/v1/parcels/{official_parcel.id}/documents/official-pdf",
        headers=citizen_headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert "inline" in response.headers["content-disposition"]
    text = pdf_text(response.content)
    assert "Asha Rao" in text
    assert "Paddy (Rice)" in text
```

### Security test

```python
def test_unrelated_citizen_cannot_view_official_pdf(client, official_parcel, other_citizen_headers):
    response = client.get(
        f"/api/v1/parcels/{official_parcel.id}/documents/official-pdf",
        headers=other_citizen_headers,
    )
    assert response.status_code == 403
```

### Overflow test

Create at least 25 ownership rows and 25 crop rows. Assert:

```python
reader = PdfReader(BytesIO(pdf_bytes))
assert len(reader.pages) >= 2
assert "Owner 24" in pdf_text(pdf_bytes)
assert "Crop 24" in pdf_text(pdf_bytes)
```

## Required frontend tests

Add a focused `Parcel360View` test with mocked API responses:

1. Render a staff viewer with a parcel response.
2. Assert that **View Official Document** and **Download Official Document** are present.
3. Click View and resolve a PDF blob.
4. Assert an iframe with title `Official land record PDF` appears.
5. Assert `URL.createObjectURL` is called once.
6. Click Close and assert `URL.revokeObjectURL` is called.
7. Mock a non-PDF response and assert a visible alert is shown.
8. Click Download and assert the anchor has `record-of-rights-{id}.pdf`.

## Definition of done

The feature is complete only when all of the following are true:

- The Python route is the backend actually serving the frontend API prefix.
- The route passes the authenticated user into the PDF data assembler.
- The PDF data model includes a clearly labeled profile section.
- Real parcel, identifier, owner, registration, tax, workflow, mutation, and crop fixture rows are inserted in tests.
- Tests extract PDF text and assert real values.
- The UI exposes separate View and Download actions.
- View opens a modal PDF viewer with browser zoom controls.
- Object URLs are revoked on close and when changing parcels.
- Unauthorized citizens receive 403.
- Long records paginate without clipped or overlapping content.
- Missing data is displayed as an explicit localized fallback, never silently as a blank field.
- The generated PDF is marked `private, no-store` and is not cached across users.

## Files that should change

| File | Change |
|---|---|
| `backend-py/app/services/land_record_pdf_service.py` | Add `ProfileInfo`, accept `User`, assemble profile, use timezone-aware timestamps |
| `backend-py/app/services/parcels_service.py` | Pass authenticated user into assembler |
| `backend-py/app/routers/parcels.py` | Return inline/private PDF headers and pass user |
| `backend-py/app/common/parcel_generation/official_document_generator.py` | Render profile block, area, and safe multi-page layout |
| `backend-py/tests/common/test_official_document_generator.py` | Assert extracted content, not only PDF signature |
| `backend-py/tests/routers/test_parcels.py` | Add populated route and security assertions |
| `frontend/src/features/parcels/OfficialPdfViewerModal.tsx` | New PDF viewer modal |
| `frontend/src/features/parcels/Parcel360View.tsx` | Add View action, object URL lifecycle, error state |
| `frontend/src/features/parcels/Parcel360View.test.tsx` | Add view/download/close/error interaction tests |
| `backend-py/requirements.txt` | Add `pypdf` as a test dependency if not already present |

## Final recommendation

Keep the current pure renderer, but treat it as only the final stage of a three-stage pipeline:

```text
Authenticated request
  -> authorization + parcel lookup
  -> database/profile assembler with explicit source policy
  -> pure PDF renderer
  -> blob response
  -> View modal or Download anchor
```

The existing implementation currently jumps from a partially populated assembler directly to a download-only UI. Adding the profile-aware data contract, deterministic fixtures, extracted-text assertions, and a managed PDF viewer will eliminate the blank-document failure mode and provide the requested end-to-end behavior.
