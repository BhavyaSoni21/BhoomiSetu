"""Tests for the OAuth service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

from app.services import oauth_service


class TestOAuthService:
    """Tests for OAuth service functions."""

    def test_generate_state(self):
        """Test that _generate_state produces a valid signed state string."""
        state1 = oauth_service._generate_state("/citizen")
        state2 = oauth_service._generate_state("/citizen")
        assert isinstance(state1, str)
        assert "." in state1  # payload.signature
        assert state1 != state2  # random nonce makes each unique

    def test_validate_state_roundtrip(self):
        """A freshly generated state validates back to its redirect URL."""
        state = oauth_service._generate_state("/officer")
        assert oauth_service._validate_state(state) == "/officer"

    def test_validate_expired_state(self):
        """Test that a state older than the TTL is rejected."""
        import json
        import time
        # Hand-build a correctly-signed state with an old timestamp.
        payload = {"r": "/citizen", "t": int(time.time()) - 700, "n": "abc"}
        payload_b64 = oauth_service._b64u(json.dumps(payload, separators=(",", ":")).encode())
        state = f"{payload_b64}.{oauth_service._sign(payload_b64)}"

        assert oauth_service._validate_state(state) is None

    def test_validate_tampered_state(self):
        """Test that a state with a bad/forged signature is rejected."""
        state = oauth_service._generate_state("/citizen")
        payload_b64, _sig = state.split(".", 1)
        tampered = f"{payload_b64}.not-a-valid-signature"
        assert oauth_service._validate_state(tampered) is None

    def test_validate_malformed_state(self):
        """Test that a structurally-invalid state is rejected, not raised."""
        assert oauth_service._validate_state("nonexistent-state") is None
        assert oauth_service._validate_state("") is None

    @patch("app.services.oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_exchange_code_for_tokens_success(self, mock_client):
        """Test successful token exchange."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test-access-token",
            "id_token": "test-id-token",
            "refresh_token": "test-refresh-token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        from app.config import Settings
        with patch("app.services.oauth_service.get_settings", return_value=Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )):
            result = await oauth_service.exchange_code_for_tokens("test-auth-code")

        assert result["access_token"] == "test-access-token"
        assert result["id_token"] == "test-id-token"

    @patch("app.services.oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_exchange_code_for_tokens_failure(self, mock_client):
        """Test token exchange failure."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Invalid grant"
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        from app.config import Settings
        with patch("app.services.oauth_service.get_settings", return_value=Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )):
            with pytest.raises(Exception) as exc_info:
                await oauth_service.exchange_code_for_tokens("invalid-code")

        assert "Failed to exchange" in str(exc_info.value)

    @patch("app.services.oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_fetch_google_userinfo_success(self, mock_client):
        """Test successful userinfo fetch."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "sub": "google-user-id-123",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/photo.jpg",
            "email_verified": True,
        }
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        result = await oauth_service.fetch_google_userinfo("test-access-token")

        assert result["sub"] == "google-user-id-123"
        assert result["email"] == "test@example.com"
        assert result["email_verified"] is True

    @patch("app.services.oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_fetch_google_userinfo_failure(self, mock_client):
        """Test userinfo fetch failure."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid token"
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        with pytest.raises(Exception) as exc_info:
            await oauth_service.fetch_google_userinfo("invalid-token")

        assert "Failed to fetch user information" in str(exc_info.value)

    def test_find_or_create_user_new_user(self, db):
        """Test creating a new user from Google OAuth."""
        from app.models.user import User

        user = oauth_service.find_or_create_user(
            db,
            google_id="google-123",
            email="newuser@example.com",
            name="New User",
            picture="https://example.com/photo.jpg",
            email_verified=True,
        )

        assert user.google_id == "google-123"
        assert user.email == "newuser@example.com"
        assert user.name == "New User"
        assert user.google_picture == "https://example.com/photo.jpg"
        assert user.google_email_verified is True
        assert user.email_verified is True
        assert user.role == "CITIZEN"
        assert user.password_hash is not None  # Should have a random password

    def test_find_or_create_user_existing_google_id(self, db):
        """Test finding existing user by Google ID."""
        from app.models.user import User
        from app.auth.passwords import hash_password

        # Create existing user
        existing = User(
            email="existing@example.com",
            password_hash=hash_password("random"),
            name="Existing User",
            role="CITIZEN",
            google_id="google-123",
            google_picture="https://example.com/old.jpg",
            google_email_verified=True,
        )
        db.add(existing)
        db.flush()

        # Find by Google ID
        user = oauth_service.find_or_create_user(
            db,
            google_id="google-123",
            email="existing@example.com",
            name="Existing User Updated",
            picture="https://example.com/new.jpg",
            email_verified=True,
        )

        assert user.id == existing.id
        assert user.name == "Existing User Updated"  # Name updated
        assert user.google_picture == "https://example.com/new.jpg"  # Picture updated

    def test_find_or_create_user_link_by_email(self, db):
        """Test linking Google account to existing user by email."""
        from app.models.user import User
        from app.auth.passwords import hash_password

        # Create existing user without Google ID
        existing = User(
            email="linkme@example.com",
            password_hash=hash_password("password123"),
            name="Link Me",
            role="CITIZEN",
            email_verified=False,
        )
        db.add(existing)
        db.flush()

        # Link Google account
        user = oauth_service.find_or_create_user(
            db,
            google_id="google-456",
            email="linkme@example.com",
            name="Link Me Google",
            picture="https://example.com/google.jpg",
            email_verified=True,
        )

        assert user.id == existing.id
        assert user.google_id == "google-456"
        assert user.google_picture == "https://example.com/google.jpg"
        assert user.google_email_verified is True
        assert user.email_verified is True  # Should be updated to True

    def test_find_or_create_user_prevents_duplicate_google_id(self, db):
        """Test that two different users can't have the same Google ID."""
        from app.models.user import User
        from app.auth.passwords import hash_password

        # Create first user with Google ID
        user1 = User(
            email="user1@example.com",
            password_hash=hash_password("password123"),
            name="User One",
            role="CITIZEN",
            google_id="google-789",
        )
        db.add(user1)
        db.flush()

        # Try to create second user with same Google ID - should return first user
        user2 = oauth_service.find_or_create_user(
            db,
            google_id="google-789",
            email="user2@example.com",
            name="User Two",
            picture=None,
            email_verified=True,
        )

        assert user2.id == user1.id  # Should return the first user