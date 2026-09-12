import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, get_db
from app.main import app


@pytest.fixture
def db() -> Session:
    """A real session against the bhoomisetu_py/PostGIS database, wrapped
    in an outer transaction that's rolled back after the test - tests can
    freely insert rows without leaving fixtures behind or colliding with
    each other. Requires `alembic upgrade head` to have already been run
    against this database (docker-compose's backend-py + postgis
    services).

    Runs the session inside a SAVEPOINT (session.begin_nested()), restarted
    by the `after_transaction_end` listener every time it ends - this is
    what lets `client` below call the *real* db.commit() (mirroring
    app.database.get_db's actual per-request commit, not a test-only
    bypass) while the outer `transaction.rollback()` at teardown still
    discards everything: each "commit" only ends the current SAVEPOINT, it
    never touches the real outer transaction on this connection. Without
    this, a test could pass while silently never exercising a real commit
    at all - which is exactly how the bug this fixture now guards against
    (get_db previously never called db.commit(), so every write endpoint
    returned a 200/201 with an id that never actually persisted) went
    undetected by the ported test suite the first time around.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        # A test that triggered an IntegrityError (asserted via
        # pytest.raises) already invalidated/deassociated this transaction
        # as part of the DBAPI-level rollback SQLAlchemy performs on
        # failure - only roll back explicitly if it's still live.
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    """A TestClient whose requests are served using the same transactional
    `db` session as the test itself - fixtures the test inserts via `db`
    are visible to the API call. Mirrors app.database.get_db's real
    commit-after-yield behavior (see the `db` fixture's docstring for why
    that matters), while everything still rolls back together at the end
    of the test.
    """

    def _override_get_db():
        yield db
        db.commit()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        del app.dependency_overrides[get_db]
