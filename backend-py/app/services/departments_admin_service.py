"""Ported from backend/src/admin/departments-admin.service.ts."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin import Department
from app.schemas.admin import CreateDepartment, UpdateDepartment


def find_all(db: Session) -> list[Department]:
    return list(db.scalars(select(Department).order_by(Department.name.asc())).all())


def find_by_code(db: Session, code: str) -> Department | None:
    return db.scalars(select(Department).where(Department.code == code)).first()


def create(db: Session, dto: CreateDepartment) -> Department:
    department = Department(**dto.model_dump(by_alias=False))
    db.add(department)
    db.flush()
    return department


def update(db: Session, department_id: UUID, dto: UpdateDepartment) -> Department | None:
    department = db.get(Department, department_id)
    if department is None:
        return None
    for key, value in dto.model_dump(exclude_unset=True, by_alias=False).items():
        setattr(department, key, value)
    db.flush()
    return department


def remove(db: Session, department_id: UUID) -> bool:
    department = db.get(Department, department_id)
    if department is None:
        return False
    db.delete(department)
    db.flush()
    return True
