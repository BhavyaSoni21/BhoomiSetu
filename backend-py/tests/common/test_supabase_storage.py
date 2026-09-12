import os

import pytest

from app.common import supabase_storage


@pytest.fixture(autouse=True)
def _no_supabase_env(monkeypatch):
    # Local-fallback mode for every test here - no real Supabase credentials
    # in the test environment.
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)


@pytest.fixture(autouse=True)
def _isolated_cwd(tmp_path, monkeypatch):
    # supabase_storage resolves its local fallback dir from cwd at import
    # time (module-level constant) - reload isn't worth it here, so this
    # patches the module constant directly instead of chdir, which the
    # already-imported _LOCAL_FALLBACK_DIR wouldn't pick up.
    monkeypatch.setattr(supabase_storage, "_LOCAL_FALLBACK_DIR", tmp_path / "uploads")


def test_upload_then_download_roundtrips_through_local_disk():
    supabase_storage.upload_to_storage("docs/test.png", b"hello", "image/png")
    assert supabase_storage.download_from_storage("docs/test.png") == b"hello"


def test_upload_creates_intermediate_directories():
    supabase_storage.upload_to_storage("a/b/c/test.png", b"x", "image/png")
    assert supabase_storage.download_from_storage("a/b/c/test.png") == b"x"


def test_rejects_a_path_traversal_key():
    with pytest.raises(RuntimeError):
        supabase_storage.upload_to_storage("../../etc/passwd", b"x", "text/plain")


def test_an_absolute_key_is_used_as_is(tmp_path):
    absolute_path = tmp_path / "elsewhere.png"
    absolute_path.write_bytes(b"already here")
    assert supabase_storage.download_from_storage(str(absolute_path)) == b"already here"
