"""Response schemas for endpoints in app/routers/parcels.py that don't
already have a schema in app/schemas/parcel.py.
"""

from datetime import date, datetime
from uuid import UUID

from app.schemas.base import CamelModel
from app.schemas.parcel import ParcelOut


class ParcelIdentifierOut(CamelModel):
    id: UUID
    identifier_type: str
    identifier_value: str
    source_state: str
    source_department: str


class ParcelWithIdentifiersOut(ParcelOut):
    """search_parcels/find_mine eager-load `identifiers` (matching the TS
    service's own `leftJoinAndSelect`/`relations: ['parcel.identifiers']`)
    - GET /parcels/:id and every GisModule endpoint don't, so this stays
    its own schema rather than added to the shared ParcelOut, which would
    otherwise pick up a populated `identifiers` field for those callers
    too via SQLAlchemy's lazy-load (a real contract change for the
    already-shipped GisModule endpoints, not just an unused extra field).
    """

    identifiers: list[ParcelIdentifierOut]


class SearchParcelsResponse(CamelModel):
    parcels: list[ParcelWithIdentifiersOut]
    total: int


class OwnershipHistoryRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    owner_name: str
    transaction_type: str
    transaction_date: date
    document_reference: str | None


class ParcelDocumentOut(CamelModel):
    id: UUID
    parcel_id: str
    document_type: str
    file_name: str
    file_path: str
    mime_type: str
    extracted_text: str | None
    registration_status: str
    created_at: datetime


class ParcelHistoricalStateOut(CamelModel):
    id: UUID
    parcel_id: str
    year: int
    land_use: str | None
    zoning_status: str | None
    restriction_status: str | None
    tax_status: str | None


class IdentifyFromDocumentResponse(CamelModel):
    extracted_text: str
    ocr_confidence: float
    candidates: list[ParcelOut]


class NotImplementedDetail(CamelModel):
    detail: str
