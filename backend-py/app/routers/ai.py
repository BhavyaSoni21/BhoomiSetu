"""Ported from backend/src/ai/ai.controller.ts.

Tech.md #31 Groq AI endpoints. KNOWN_RISKS.md HIGH-1: tighter than the
app-wide default (30/min vs 200/min/IP, see app/rate_limit.py) - every
request here costs a real Groq API call, matching the original's
@Throttle({ default: { limit: 30, ttl: 60000 } }) applied to the whole
AiController.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional, require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.ai import AiExplanationOut, AssistantQueryResponse, NaturalLanguageQuery
from app.services import ai_service
from app.services.ai_service import AiResponseValidationError

router = APIRouter(prefix="/ai", tags=["ai"])


# Citizen-facing (the floating "Ask AI" widget on the Citizen Portal) - stays
# public. Handles both a data question and a how-do-I-use-this-site
# question in one call - see ai_service.ask_assistant.
@router.post("/query", response_model=AssistantQueryResponse, response_model_exclude_none=True)
@limiter.limit("30/minute")
def query(request: Request, dto: NaturalLanguageQuery, db: Session = Depends(get_db)):
    try:
        return ai_service.ask_assistant(db, dto.query)
    except AiResponseValidationError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


# Citizen-facing ("Explain with AI" on Parcel 360, a shared route) - stays
# public, but get_current_user_optional lets ai_service know who's asking
# (if anyone) so it can withhold Planning/Tax/Restriction/Dispute/
# Encumbrance from the summary exactly like GET /parcels/:id/360 already
# does for a non-owner viewer.
@router.post("/parcels/{parcel_id}/explain", response_model=AiExplanationOut)
@limiter.limit("30/minute")
def explain_parcel(request: Request, parcel_id: UUID, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    try:
        result = ai_service.explain_parcel(db, str(parcel_id), user)
    except AiResponseValidationError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Parcel not found: {parcel_id}")
    return result.model_dump()


# Officer-only (GovernanceAlertsPanel's "Explain" button) - governance
# alerts have no citizen-facing surface at all.
@router.post("/alerts/{alert_id}/explain", response_model=AiExplanationOut)
@limiter.limit("30/minute")
def explain_alert(request: Request, alert_id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    try:
        result = ai_service.explain_alert(db, str(alert_id))
    except AiResponseValidationError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance alert not found: {alert_id}")
    return result.model_dump()
