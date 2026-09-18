"""Dynamic profile fields API - admin management and user-facing config."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.profile_field import (
    ProfileFieldOut,
    ProfileFieldCreate,
    ProfileFieldUpdate,
    ProfileFormConfig,
)
from app.services.profile_field_service import (
    get_active_fields_for_role,
    get_all_fields,
    create_field,
    update_field,
    delete_field,
    get_profile_form_config,
    validate_profile_data,
)

router = APIRouter(prefix="/profile-fields", tags=["profile-fields"])


@router.get("/config/{role}", response_model=ProfileFormConfig)
def get_form_config(role: str, db: Session = Depends(get_db)):
    """Get profile form configuration for a specific role (used by frontend)."""
    return get_profile_form_config(db, role)


@router.get("", response_model=list[ProfileFieldOut])
def list_fields(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """List all profile fields (admin only)."""
    return [ProfileFieldOut.model_validate(f) for f in get_all_fields(db)]


@router.post("", response_model=ProfileFieldOut, status_code=status.HTTP_201_CREATED)
def create_profile_field(data: ProfileFieldCreate, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Create a new profile field (admin only)."""
    # Check for duplicate field_name
    if get_active_fields_for_role(db, "ADMIN"):  # This will get all fields since ADMIN has all roles
        existing = db.query(ProfileField).filter(ProfileField.field_name == data.field_name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Field '{data.field_name}' already exists")
    field = create_field(db, data)
    return ProfileFieldOut.model_validate(field)


@router.patch("/{field_name}", response_model=ProfileFieldOut)
def update_profile_field(field_name: str, data: ProfileFieldUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Update a profile field (admin only)."""
    field = update_field(db, field_name, data)
    if not field:
        raise HTTPException(status_code=404, detail=f"Field '{field_name}' not found")
    return ProfileFieldOut.model_validate(field)


@router.delete("/{field_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile_field(field_name: str, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Delete a profile field (admin only)."""
    if not delete_field(db, field_name):
        raise HTTPException(status_code=404, detail=f"Field '{field_name}' not found")


@router.post("/validate/{role}")
def validate_profile(role: str, data: dict, db: Session = Depends(get_db)):
    """Validate profile data against field configurations for a role."""
    is_valid, errors = validate_profile_data(db, role, data)
    return {"valid": is_valid, "errors": errors}