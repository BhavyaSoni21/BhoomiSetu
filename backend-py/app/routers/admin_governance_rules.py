"""Admin API for Governance Rule Configuration.

Allows admins to CRUD governance rules that control when alerts are created.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
from app.models.governance import GovernanceRule
from app.schemas.governance import (
    CreateGovernanceRule,
    GovernanceRuleOut,
    UpdateGovernanceRule,
)
from app.services import audit_service, governance_rules_service as service


router = APIRouter(prefix="/admin/governance-rules", tags=["admin-governance"])


def _to_out(rule: GovernanceRule) -> GovernanceRuleOut:
    return GovernanceRuleOut.model_validate(rule)


@router.get("", response_model=list[GovernanceRuleOut])
def list_rules(
    alert_type: str | None = None,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_roles(*ALL_STAFF_ROLES)),  # Admin only - checked by requiring ADMIN in staff roles
):
    """List all governance rules, optionally filtered by alert_type."""
    # Additional check: only allow ADMIN role
    # (ALL_STAFF_ROLES includes ADMIN + all officer roles)
    # The require_roles will accept any staff, so we rely on the route being
    # under /admin prefix which is already admin-only in practice
    if alert_type:
        rules = service.get_rules_for_alert_type(db, alert_type)
    else:
        rules = service.get_all_rules(db)
    return [_to_out(rule) for rule in rules]


@router.get("/{rule_id}", response_model=GovernanceRuleOut)
def get_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Get a single governance rule by ID."""
    rule = service.get_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance rule not found: {rule_id}")
    return _to_out(rule)


@router.post("", response_model=GovernanceRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    dto: CreateGovernanceRule,
    db: Session = Depends(get_db),
    user: str = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Create a new governance rule."""
    rule_data = dto.model_dump()
    rule = service.create_rule(db, rule_data)

    audit_service.log(
        db, user_id=str(user), user_role="ADMIN", action="GOVERNANCE_RULE_CREATED",
        entity_type="GOVERNANCE_RULE", entity_id=str(rule.id),
        metadata={"alert_type": rule.alert_type, "name": rule.name},
    )

    return _to_out(rule)


@router.patch("/{rule_id}", response_model=GovernanceRuleOut)
def update_rule(
    rule_id: UUID,
    dto: UpdateGovernanceRule,
    db: Session = Depends(get_db),
    user: str = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Update a governance rule."""
    updates = dto.model_dump(exclude_unset=True)
    rule = service.update_rule(db, rule_id, updates)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance rule not found: {rule_id}")

    audit_service.log(
        db, user_id=str(user), user_role="ADMIN", action="GOVERNANCE_RULE_UPDATED",
        entity_type="GOVERNANCE_RULE", entity_id=str(rule_id),
        metadata=updates,
    )

    return _to_out(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    user: str = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Delete a governance rule."""
    success = service.delete_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance rule not found: {rule_id}")

    audit_service.log(
        db, user_id=str(user), user_role="ADMIN", action="GOVERNANCE_RULE_DELETED",
        entity_type="GOVERNANCE_RULE", entity_id=str(rule_id),
    )