from app.common.pagination import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, resolve_pagination


def test_defaults_when_nothing_supplied():
    assert resolve_pagination() == (DEFAULT_PAGE_LIMIT, 0)


def test_honors_a_supplied_limit_and_offset():
    assert resolve_pagination(limit=20, offset=40) == (20, 40)


def test_caps_limit_at_the_ceiling():
    assert resolve_pagination(limit=10_000) == (MAX_PAGE_LIMIT, 0)


def test_ignores_a_non_positive_limit_or_offset():
    assert resolve_pagination(limit=0, offset=-5) == (DEFAULT_PAGE_LIMIT, 0)
