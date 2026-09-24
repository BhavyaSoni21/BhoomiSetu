"""Per-account login lockout mechanism (app/auth/login_guard.py).

Like test_rate_limiting.py, the mechanism is exercised in isolation: the
guard is disabled under pytest for the shared app, so we flip it on here and
reset() around each assertion rather than driving it through the login route.
"""

import app.auth.login_guard as g


def _run(fn):
    g._enabled = True
    g.reset()
    try:
        fn()
    finally:
        g.reset()
        g._enabled = False


def test_locks_after_max_attempts():
    def body():
        ident = "attacker@example.com"
        for _ in range(g.MAX_ATTEMPTS - 1):
            g.record_failure(ident)
            assert g.is_locked(ident) is None  # not yet
        g.record_failure(ident)  # MAX-th failure
        assert g.is_locked(ident) is not None
    _run(body)


def test_success_clears_failures():
    def body():
        ident = "user@example.com"
        for _ in range(g.MAX_ATTEMPTS - 1):
            g.record_failure(ident)
        g.record_success(ident)
        g.record_failure(ident)  # counter reset, so this is #1 again
        assert g.is_locked(ident) is None
    _run(body)


def test_disabled_is_noop():
    g._enabled = False
    g.reset()
    ident = "user@example.com"
    for _ in range(g.MAX_ATTEMPTS + 3):
        g.record_failure(ident)
    assert g.is_locked(ident) is None
