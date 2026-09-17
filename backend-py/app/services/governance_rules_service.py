"""Governance Rule Configuration Service.

Admin-editable rules that define when GovernanceAlerts are created.
Replaces hardcoded alert creation logic in change_detection_service,
historical_comparison_service, and spatial_service.
"""

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.governance import GovernanceAlert, GovernanceRule


def get_rules_for_alert_type(db: Session, alert_type: str) -> list[GovernanceRule]:
    """Get all active rules for a given alert type."""
    stmt = select(GovernanceRule).where(
        GovernanceRule.alert_type == alert_type,
        GovernanceRule.is_active.is_(True)
    )
    return list(db.scalars(stmt).all())


def get_all_rules(db: Session) -> list[GovernanceRule]:
    """Get all governance rules."""
    stmt = select(GovernanceRule).order_by(GovernanceRule.alert_type, GovernanceRule.name)
    return list(db.scalars(stmt).all())


def get_rule(db: Session, rule_id: UUID) -> GovernanceRule | None:
    """Get a single rule by ID."""
    return db.get(GovernanceRule, str(rule_id))


def create_rule(db: Session, rule_data: dict[str, Any]) -> GovernanceRule:
    """Create a new governance rule."""
    # Validate condition_config is valid JSON
    json.loads(rule_data["condition_config"])
    rule = GovernanceRule(**rule_data)
    db.add(rule)
    db.flush()
    return rule


def update_rule(db: Session, rule_id: UUID, updates: dict[str, Any]) -> GovernanceRule | None:
    """Update an existing governance rule."""
    rule = db.get(GovernanceRule, str(rule_id))
    if rule is None:
        return None

    if "condition_config" in updates and updates["condition_config"] is not None:
        json.loads(updates["condition_config"])  # Validate JSON

    for key, value in updates.items():
        if value is not None:
            setattr(rule, key, value)

    db.flush()
    return rule


def delete_rule(db: Session, rule_id: UUID) -> bool:
    """Delete a governance rule."""
    rule = db.get(GovernanceRule, str(rule_id))
    if rule is None:
        return False
    db.delete(rule)
    db.flush()
    return True


def evaluate_rules_and_create_alerts(
    db: Session,
    alert_type: str,
    parcel_id: str,
    context: dict[str, Any],
) -> list[GovernanceAlert]:
    """Evaluate all active rules for an alert type and create alerts if conditions match.

    Args:
        db: Database session
        alert_type: Type of alert (e.g., RESTRICTION_ZONE_OVERLAP)
        parcel_id: Parcel UUID string
        context: Context data for rule evaluation (e.g., geometry, pixel_ratio, categories, etc.)

    Returns:
        List of created GovernanceAlert objects
    """
    rules = get_rules_for_alert_type(db, alert_type)
    if not rules:
        return []

    alerts_to_create = []

    for rule in rules:
        condition = json.loads(rule.condition_config)

        # Evaluate condition based on alert_type
        if _evaluate_condition(alert_type, condition, context):
            # Determine severity - check for category-specific severity override
            severity = rule.default_severity
            to_category = context.get("to_category")
            severity_by_category = condition.get("severity_by_category")
            if to_category and severity_by_category and to_category in severity_by_category:
                severity = severity_by_category[to_category]

            # Build explanation from template
            explanation = _render_explanation(rule.explanation_template, context)

            alert = GovernanceAlert(
                parcel_id=parcel_id,
                alert_type=alert_type,
                severity=severity,
                source=_source_for_alert_type(alert_type),
                status="OPEN",
                explanation=explanation,
            )
            alerts_to_create.append(alert)

    if alerts_to_create:
        db.add_all(alerts_to_create)
        db.flush()

    return alerts_to_create


def _evaluate_condition(alert_type: str, condition: dict[str, Any], context: dict[str, Any]) -> bool:
    """Evaluate a rule condition against context data.

    Condition format varies by alert_type:
    - RESTRICTION_ZONE_OVERLAP: {"intersects": true}
    - UNAUTHORIZED_CHANGE_DETECTED: {"min_pixel_ratio": 0.01}
    - RESTRICTION_DETECTED: {"categories": ["RESTRICTED"]}
    - DISPUTE_DETECTED: {"categories": ["DISPUTE_OWNERSHIP", "DISPUTE_BOUNDARY", ...]}
    - TAX_OVERDUE: {"min_overdue_amount": 100}
    """
    if alert_type == "RESTRICTION_ZONE_OVERLAP":
        # Always trigger if parcel intersects zone (context has "intersects": true)
        return condition.get("intersects", True) and context.get("intersects", False)

    elif alert_type == "UNAUTHORIZED_CHANGE_DETECTED":
        # Trigger if changed pixel ratio exceeds threshold
        min_ratio = condition.get("min_pixel_ratio", 0.01)
        return context.get("changed_pixel_ratio", 0) >= min_ratio

    elif alert_type == "RESTRICTION_DETECTED":
        # Trigger if parcel's category is in the monitored categories
        monitored_categories = condition.get("categories", ["RESTRICTED"])
        return context.get("to_category") in monitored_categories

    elif alert_type == "DISPUTE_DETECTED":
        # Trigger if parcel's category is a dispute type
        dispute_categories = condition.get("categories", [
            "DISPUTE_OWNERSHIP", "DISPUTE_BOUNDARY", "DISPUTE_INHERITANCE", "DISPUTE_ENCROACHMENT"
        ])
        return context.get("to_category") in dispute_categories

    elif alert_type == "TAX_OVERDUE":
        # Trigger if overdue amount exceeds threshold
        min_amount = condition.get("min_overdue_amount", 100)
        return context.get("overdue_amount", 0) >= min_amount

    return False


def _render_explanation(template: str, context: dict[str, Any]) -> str:
    """Render explanation template with context placeholders.

    Supported placeholders: {changed_pixel_ratio}, {from_category}, {to_category},
    {overdue_amount}, {zone_name}, {parcel_id}, etc.
    """
    try:
        return template.format(**context)
    except KeyError:
        # If template has placeholders not in context, return template as-is
        return template


def _source_for_alert_type(alert_type: str) -> str:
    """Map alert_type to source."""
    mapping = {
        "RESTRICTION_ZONE_OVERLAP": "RESTRICTION_MONITOR",
        "UNAUTHORIZED_CHANGE_DETECTED": "CHANGE_DETECTION",
        "RESTRICTION_DETECTED": "HISTORICAL_IMAGERY",
        "DISPUTE_DETECTED": "HISTORICAL_IMAGERY",
        "TAX_OVERDUE": "TAX_MONITOR",
    }
    return mapping.get(alert_type, "UNKNOWN")