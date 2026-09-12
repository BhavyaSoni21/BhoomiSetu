"""Ported from backend/src/common/pagination.ts - KNOWN_RISKS.md HIGH-6.

Every "list everything" endpoint gets the same default/ceiling instead of
drifting per-endpoint. DEFAULT_PAGE_LIMIT (200) is deliberately generous
rather than a tight "page size" - these are "recent activity" views
(newest-first), not a paged UI; the goal is closing the unbounded-growth
risk without changing what an admin/officer currently sees.
"""

DEFAULT_PAGE_LIMIT = 200
MAX_PAGE_LIMIT = 500


def resolve_pagination(limit: int | None = None, offset: int | None = None) -> tuple[int, int]:
    """Returns (take, skip)."""
    take = min(limit, MAX_PAGE_LIMIT) if limit is not None and limit > 0 else DEFAULT_PAGE_LIMIT
    skip = offset if offset is not None and offset > 0 else 0
    return take, skip
