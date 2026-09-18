"""Dynamic profile field schemas - generated from database config.
"""

from pydantic import BaseModel, Field
from typing import Any, Optional
from uuid import UUID
from datetime import datetime


class ProfileFieldOut(BaseModel):
    """Profile field configuration as returned to frontend for dynamic form rendering."""

    id: UUID
    field_name: str
    field_label: str
    field_type: str
    field_options: Optional[dict] = None
    is_required: bool
    is_editable: bool
    display_order: int
    roles: Optional[list[str]] = None
    validation_regex: Optional[str] = None
    help_text: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ProfileFieldCreate(BaseModel):
    """Admin creates a new profile field."""

    field_name: str = Field(..., max_length=50)
    field_label: str = Field(..., max_length=100)
    field_type: str = Field(..., max_length=20)
    field_options: Optional[dict] = None
    is_required: bool = False
    is_editable: bool = True
    display_order: int = 0
    roles: Optional[list[str]] = None
    validation_regex: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=300)
    is_active: bool = True


class ProfileFieldUpdate(BaseModel):
    """Admin updates a profile field."""

    field_label: Optional[str] = Field(None, max_length=100)
    field_type: Optional[str] = Field(None, max_length=20)
    field_options: Optional[dict] = None
    is_required: Optional[bool] = None
    is_editable: Optional[bool] = None
    display_order: Optional[int] = None
    roles: Optional[list[str]] = None
    validation_regex: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=300)
    is_active: Optional[bool] = None


class DynamicProfileData(BaseModel):
    """Dynamic profile data - keys match field_name from profile_fields table."""

    # This will be populated dynamically at runtime based on profile_fields table
    model_config = {"extra": "allow"}


class ProfileFormConfig(BaseModel):
    """Complete profile form configuration for a specific role."""

    role: str
    fields: list[ProfileFieldOut]