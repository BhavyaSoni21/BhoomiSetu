"""Per-account failed-login lockout - the second layer rate_limit.py's
docstring calls out as missing (KNOWN_RISKS.md HIGH-1). The per-IP limiter
doesn't stop a distributed guess against one account; this does, by locking
an identifier after too many failures regardless of source IP.

In-memory, single-process - same characteristic (and same trade-off) as the
IP limiter's default store. Disabled under pytest by default so the shared
TestClient app doesn't accumulate lockouts across unrelated auth tests; the
dedicated test flips `_enabled` on and calls reset() itself.

ponytail: process-local dict, no lock - concurrent failures may miscount by
one under the FastAPI threadpool, which only fuzzes the threshold, never
unlocks a locked account. Move the counter to a User column / shared store
if the backend ever runs multi-instance.
"""

import os
from datetime import datetime, timedelta, timezone

MAX_ATTEMPTS = 5
LOCKOUT = timedelta(minutes=15)

_enabled = "PYTEST_CURRENT_TEST" not in os.environ and (
    os.environ.get("RATE_LIMIT_ENABLED", "true").strip().lower() != "false"
)

# identifier -> (fail_count, locked_until | None)
_failures: dict[str, tuple[int, datetime | None]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_locked(identifier: str) -> datetime | None:
    """Lock expiry if `identifier` is currently locked, else None. Clears a
    lapsed lock so the next window starts fresh."""
    if not _enabled or not identifier:
        return None
    entry = _failures.get(identifier)
    if not entry:
        return None
    _, locked_until = entry
    if locked_until is None:
        return None
    if locked_until > _now():
        return locked_until
    _failures.pop(identifier, None)  # lock expired
    return None


def record_failure(identifier: str) -> None:
    if not _enabled or not identifier:
        return
    count, locked_until = _failures.get(identifier, (0, None))
    count += 1
    if count >= MAX_ATTEMPTS:
        locked_until = _now() + LOCKOUT
    _failures[identifier] = (count, locked_until)


def record_success(identifier: str) -> None:
    if not _enabled or not identifier:
        return
    _failures.pop(identifier, None)


def reset() -> None:
    """Test hook - clear all tracked state."""
    _failures.clear()
