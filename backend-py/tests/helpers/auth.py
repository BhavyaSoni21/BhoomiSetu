"""Ported from backend/test/helpers/auth.ts.

Shared by every test that hits a route behind require_roles(). Mints a
real JWT the same way app.auth.deps.create_access_token does, but skips
the bcrypt/login round trip - the password is never checked by anything
downstream, since get_current_user looks the user up by id, not by
re-verifying credentials.
"""

import itertools

from sqlalchemy.orm import Session

from app.auth.deps import create_access_token
from app.models.user import User

_counter = itertools.count(1)


def create_authenticated_user(db: Session, role: str) -> tuple[User, str, dict]:
    n = next(_counter)
    user = User(
        email=f"rbac-test-{role.lower()}-{n}@test.gov.in",
        password_hash="not-used-by-this-helper",
        name=f"Test {role}",
        role=role,
    )
    db.add(user)
    db.flush()
    token = create_access_token(user)
    return user, token, {"Authorization": f"Bearer {token}"}
