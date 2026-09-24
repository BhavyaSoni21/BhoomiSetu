"""Service for dynamic profile fields - reads configuration from database."""

from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic.alias_generators import to_snake

from app.models.profile_field import ProfileField
from app.schemas.profile_field import ProfileFieldOut, ProfileFieldCreate, ProfileFieldUpdate, ProfileFormConfig


def get_active_fields_for_role(db: Session, role: str) -> list[ProfileField]:
    """Get all active profile fields that apply to the given role."""
    fields = db.query(ProfileField).filter(ProfileField.is_active == True).all()
    # Filter by role - if roles is None or empty, field applies to all roles
    filtered = []
    for field in fields:
        if field.roles is None or len(field.roles) == 0 or role in field.roles:
            filtered.append(field)
    # Sort by display_order
    filtered.sort(key=lambda f: f.display_order)
    return filtered


def get_all_fields(db: Session) -> list[ProfileField]:
    """Get all profile fields (for admin management)."""
    return db.query(ProfileField).order_by(ProfileField.display_order).all()


def get_field_by_name(db: Session, field_name: str) -> ProfileField | None:
    """Get a specific profile field by name."""
    return db.query(ProfileField).filter(ProfileField.field_name == field_name).first()


def create_field(db: Session, data: ProfileFieldCreate) -> ProfileField:
    """Create a new profile field."""
    field = ProfileField(
        field_name=data.field_name,
        field_label=data.field_label,
        field_type=data.field_type,
        field_options=data.field_options,
        is_required=data.is_required,
        is_editable=data.is_editable,
        display_order=data.display_order,
        roles=data.roles,
        validation_regex=data.validation_regex,
        help_text=data.help_text,
        is_active=data.is_active,
    )
    db.add(field)
    db.flush()
    return field


def update_field(db: Session, field_name: str, data: ProfileFieldUpdate) -> ProfileField | None:
    """Update a profile field."""
    field = get_field_by_name(db, field_name)
    if not field:
        return None
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(field, key, value)
    db.flush()
    return field


def delete_field(db: Session, field_name: str) -> bool:
    """Delete a profile field."""
    field = get_field_by_name(db, field_name)
    if not field:
        return False
    db.delete(field)
    db.flush()
    return True


def get_profile_form_config(db: Session, role: str) -> ProfileFormConfig:
    """Get complete profile form configuration for a role."""
    fields = get_active_fields_for_role(db, role)
    return ProfileFormConfig(role=role, fields=[ProfileFieldOut.model_validate(f) for f in fields])


def validate_profile_data(db: Session, role: str, data: dict) -> tuple[bool, list[str]]:
    """Validate profile data against field configurations.
    Returns (is_valid, list_of_errors).

    This is a partial update: an unsent field keeps its stored value, so a
    required field simply absent from the payload is NOT an error here (that
    belongs to registration). We only validate the fields actually submitted.
    """
    # The frontend sends camelCase (governmentIdNumber); field_name is
    # snake_case (government_id_number). Normalise so both required and regex
    # checks actually match the submitted field. to_snake is a no-op for
    # single-word keys.
    data = {to_snake(k): v for k, v in data.items()}
    fields = get_active_fields_for_role(db, role)
    errors = []

    for field in fields:
        if field.field_name not in data:
            continue  # not being changed - leave the stored value untouched
        value = data.get(field.field_name)
        if field.is_required and (value is None or value == ""):
            errors.append(f"{field.field_label} is required")
            continue
        if value is not None and value != "" and field.validation_regex:
            import re
            if not re.match(field.validation_regex, str(value)):
                errors.append(f"{field.field_label} format is invalid")

    return len(errors) == 0, errors