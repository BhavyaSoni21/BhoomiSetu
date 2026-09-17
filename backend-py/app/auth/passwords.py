"""Shared bcrypt hashing, used by UsersModule (admin-provisioned staff
accounts) and, later, AuthModule (citizen self-registration/login).

Uses the `bcrypt` package directly rather than passlib's `CryptContext` -
passlib 1.7.4 (the version originally pinned in requirements.txt from
Phase 0, before this hashing code actually existed to exercise it) runs
a self-test at import time that crashes against bcrypt>=4.1
("password cannot be longer than 72 bytes"), a known passlib/bcrypt
compatibility break. Found during this module's own verification;
requirements.txt now pins a plain `bcrypt` instead.
"""

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
