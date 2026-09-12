"""Ported from backend/src/users/users.service.ts."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.roles import ALL_STAFF_ROLES
from app.models.user import User


def find_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(User.email == email)).first()


def find_by_mobile_number(db: Session, mobile_number: str) -> User | None:
    return db.scalars(select(User).where(User.mobile_number == mobile_number)).first()


def find_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def find_all(db: Session) -> list[User]:
    """Staff only - this backs the Admin Portal's "User Management" list
    (officer/admin account administration), which citizen accounts were
    never part of. Without this filter, citizen sign-in accounts would
    silently spill into this admin-only staff list.
    """
    return list(db.scalars(select(User).where(User.role.in_(ALL_STAFF_ROLES)).order_by(User.created_at.desc())).all())


def create(db: Session, *, email: str | None, password_hash: str, name: str, role: str, email_verified: bool = False, mobile_number: str | None = None, mobile_verified: bool = False) -> User:
    user = User(email=email, mobile_number=mobile_number, email_verified=email_verified, mobile_verified=mobile_verified, password_hash=password_hash, name=name, role=role)
    db.add(user)
    db.flush()
    return user


def update_role(db: Session, user_id: UUID, role: str) -> User | None:
    user = db.get(User, user_id)
    if user is None:
        return None
    user.role = role
    db.flush()
    return user


def remove(db: Session, user_id: UUID) -> bool:
    user = db.get(User, user_id)
    if user is None:
        return False
    db.delete(user)
    db.flush()
    return True
