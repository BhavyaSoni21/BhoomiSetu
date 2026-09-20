"""Ported from backend/src/departments/*.entity.ts response shapes +
land-records-lookup.service.ts's LandRecordsLookupResult.
"""

from datetime import date
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.land_records import StateALandRecordOut, StateBLandRecordOut


class RegistrationRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    registration_status: str
    registration_number: str | None
    registration_date: date | None
    last_transaction_type: str | None
    last_transaction_date: date | None


class PlanningRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    land_use: str
    zoning_classification: str
    master_plan_reference: str
    building_permission_status: str


class TaxRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    assessed_value: float
    annual_tax_amount: float
    tax_status: str
    outstanding_amount: float
    last_payment_date: date | None
    market_value_reference: float | None
    valuation_date: date | None
    valuation_source: str | None


class RestrictionRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    has_restriction: bool
    restriction_type: str | None
    restriction_details: str | None
    imposing_authority: str | None


class DisputeRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    has_active_dispute: bool
    dispute_type: str | None
    case_status: str | None
    filing_date: date | None
    resolution_date: date | None
    resolution_summary: str | None


class EncumbranceRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    has_encumbrance: bool
    encumbrance_type: str | None
    lender_name: str | None
    instrument_reference: str | None
    registered_date: date | None
    discharge_date: date | None


class SurveyRecordOut(CamelModel):
    id: UUID
    parcel_id: str
    survey_status: str
    survey_type: str | None
    measured_area_sq_m: float | None
    original_area_sq_m: float | None
    area_delta_sq_m: float | None
    geometry_updated: bool
    survey_date: date | None
    surveyor_notes: str | None
    reference_document: str | None


class IdentifierUsed(CamelModel):
    type: str
    value: str


class LandRecordsLookupOut(CamelModel):
    source: str
    schema_: str = Field(alias="schema")
    identifier_used: IdentifierUsed
    data: StateALandRecordOut | StateBLandRecordOut
