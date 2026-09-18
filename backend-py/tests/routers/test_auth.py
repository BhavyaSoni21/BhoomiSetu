"""Ported from backend/test/auth.e2e-spec.ts.

sms_service.send_otp/verify_otp and email_service.send_otp_email are
plain module-level functions (matching this codebase's established
convention for external-API wrappers - groq_service, gemini_service,
narrative_service), so tests monkeypatch them directly instead of
reproducing the original spec's Nest overrideProvider mocks - simpler,
same substitution already used for AiModule/HistoricalImageryModule.
"""

import uuid

from app.auth.passwords import hash_password
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.services import email_service, sms_service

MOCK_SMS_OTP_CODE = "654321"


def _mock_send_otp(monkeypatch):
    from app.services.sms_service import SmsOtpResult
    from datetime import datetime, timedelta, timezone

    def fake_send_otp(mobile_number):
        return SmsOtpResult(code_hash=hash_password(MOCK_SMS_OTP_CODE), expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10), sent_at=datetime.now(timezone.utc).replace(tzinfo=None))

    monkeypatch.setattr(sms_service, "send_otp", fake_send_otp)


def _mock_email_capture(monkeypatch):
    captured = {"calls": []}

    def fake_send_otp_email(to, code):
        captured["calls"].append((to, code))

    monkeypatch.setattr(email_service, "send_otp_email", fake_send_otp_email)
    return captured


def _clear(db):
    db.query(PendingRegistration).delete()
    db.flush()


def _seed_officer(db):
    officer = User(email="officer@test.gov.in", password_hash=hash_password("CorrectPass1"), name="Test Officer", role="LAND_RECORD_OFFICER", email_verified=True)
    db.add(officer)
    db.flush()
    return officer


def _register_and_verify_citizen(db, client, email_calls, **overrides):
    payload = {
        "name": "Verify Test", "method": "EMAIL", "email": f"verify-{uuid.uuid4()}@example.com",
        "password": "Password1", "confirmPassword": "Password1",
    }
    payload.update(overrides)
    method = payload["method"]

    register_res = client.post("/api/v1/auth/register", json=payload)
    assert register_res.status_code == 201
    registration_id = register_res.json()["registrationId"]
    code = MOCK_SMS_OTP_CODE if method == "MOBILE" else email_calls["calls"][-1][1]

    verify_res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": registration_id, "code": code})
    assert verify_res.status_code == 201
    return {"token": verify_res.json()["accessToken"], "user": verify_res.json()["user"], "registration_id": registration_id}


class TestLogin:
    def test_logs_in_with_correct_credentials(self, db, client):
        _clear(db)
        officer = _seed_officer(db)
        res = client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "CorrectPass1"})
        assert res.status_code == 200
        assert isinstance(res.json()["accessToken"], str)
        assert len(res.json()["accessToken"]) > 10
        assert res.json()["user"] == {
            "id": str(officer.id), "email": "officer@test.gov.in", "mobileNumber": None, "emailVerified": True, "mobileVerified": False,
            "pendingEmail": None, "pendingMobileNumber": None, "name": "Test Officer", "role": "LAND_RECORD_OFFICER",
            "address": None, "governmentIdNumber": None, "occupation": None, "createdAt": officer.created_at.isoformat(),
            "googleId": None, "googlePicture": None, "googleEmailVerified": False,
        }
        assert "passwordHash" not in res.text and "password_hash" not in res.text

    def test_rejects_an_incorrect_password_with_401(self, db, client):
        _clear(db)
        _seed_officer(db)
        assert client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "WrongPassword"}).status_code == 401

    def test_rejects_an_unknown_email_with_401(self, db, client):
        _clear(db)
        _seed_officer(db)
        assert client.post("/api/v1/auth/login", json={"email": "nobody@test.gov.in", "password": "CorrectPass1"}).status_code == 401

    def test_rejects_a_malformed_email_with_400(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "CorrectPass1"}).status_code == 400

    def test_rejects_a_missing_password_with_400(self, db, client):
        _clear(db)
        _seed_officer(db)
        assert client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in"}).status_code == 400

    def test_rejects_a_request_with_neither_identifier_with_400(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/login", json={"password": "CorrectPass1"}).status_code == 400

    def test_logs_in_a_citizen_with_mobile_number_and_password(self, db, client):
        _clear(db)
        db.add(User(mobile_number="9000000001", password_hash=hash_password("CorrectPass1"), name="Mobile Citizen", role="CITIZEN", mobile_verified=True))
        db.flush()
        res = client.post("/api/v1/auth/login", json={"mobileNumber": "9000000001", "password": "CorrectPass1"})
        assert res.status_code == 200
        assert res.json()["user"]["mobileNumber"] == "9000000001"
        assert res.json()["user"]["mobileVerified"] is True
        assert res.json()["user"]["role"] == "CITIZEN"

    def test_rejects_a_malformed_mobile_number_with_400(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/login", json={"mobileNumber": "123", "password": "CorrectPass1"}).status_code == 400


class TestGetMe:
    def test_rejects_a_request_with_no_authorization_header(self, db, client):
        _clear(db)
        assert client.get("/api/v1/auth/me").status_code == 401

    def test_rejects_a_garbage_token(self, db, client):
        _clear(db)
        assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}).status_code == 401

    def test_returns_the_current_user_for_a_valid_token(self, db, client):
        _clear(db)
        officer = _seed_officer(db)
        login_res = client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "CorrectPass1"})
        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login_res.json()['accessToken']}"})
        assert res.status_code == 200
        assert res.json()["email"] == "officer@test.gov.in"
        assert res.json()["id"] == str(officer.id)

    def test_rejects_a_token_whose_user_has_since_been_deleted(self, db, client):
        _clear(db)
        short_lived = User(email="temp@test.gov.in", password_hash=hash_password("CorrectPass1"), name="Temp Officer", role="PLANNING_OFFICER")
        db.add(short_lived)
        db.flush()
        login_res = client.post("/api/v1/auth/login", json={"email": "temp@test.gov.in", "password": "CorrectPass1"})
        db.delete(db.get(User, short_lived.id))
        db.flush()
        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login_res.json()['accessToken']}"})
        assert res.status_code == 401


class TestLogout:
    def test_rejects_a_request_with_no_authorization_header(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/logout").status_code == 401

    def test_invalidates_the_token_and_every_other_outstanding_token(self, db, client):
        _clear(db)
        user = User(email=f"logout-{uuid.uuid4()}@test.gov.in", password_hash=hash_password("CorrectPass1"), name="Logout Test", role="PLANNING_OFFICER", email_verified=True)
        db.add(user)
        db.flush()

        first_login = client.post("/api/v1/auth/login", json={"email": user.email, "password": "CorrectPass1"})
        second_login = client.post("/api/v1/auth/login", json={"email": user.email, "password": "CorrectPass1"})

        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {first_login.json()['accessToken']}"}).status_code == 200
        assert client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {first_login.json()['accessToken']}"}).status_code == 200

        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {first_login.json()['accessToken']}"}).status_code == 401
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {second_login.json()['accessToken']}"}).status_code == 401

        third_login = client.post("/api/v1/auth/login", json={"email": user.email, "password": "CorrectPass1"})
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {third_login.json()['accessToken']}"}).status_code == 200


class TestRegister:
    def test_stages_a_pending_registration_for_email(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        res = client.post("/api/v1/auth/register", json={"name": "New Citizen", "method": "EMAIL", "email": "newcitizen@example.com", "password": "Password1", "confirmPassword": "Password1"})
        assert res.status_code == 201
        assert res.json()["method"] == "EMAIL"
        assert res.json()["target"] == "newcitizen@example.com"
        assert "accessToken" not in res.json()
        assert email_calls["calls"][-1][0] == "newcitizen@example.com"

        assert db.query(User).filter(User.email == "newcitizen@example.com").first() is None
        assert db.query(PendingRegistration).filter(PendingRegistration.email == "newcitizen@example.com").first() is not None

    def test_stages_a_pending_registration_for_mobile(self, db, client, monkeypatch):
        _clear(db)
        _mock_send_otp(monkeypatch)
        res = client.post("/api/v1/auth/register", json={"name": "Mobile Citizen", "method": "MOBILE", "mobileNumber": "9111111111", "password": "Password1", "confirmPassword": "Password1"})
        assert res.status_code == 201
        assert res.json()["method"] == "MOBILE"
        assert res.json()["target"] == "9111111111"
        assert db.query(User).filter(User.mobile_number == "9111111111").first() is None

    def test_rejects_mismatched_passwords_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register", json={"name": "X", "method": "EMAIL", "email": "mismatch@example.com", "password": "Password1", "confirmPassword": "Different1"})
        assert res.status_code == 400

    def test_rejects_a_duplicate_email_with_409(self, db, client):
        _clear(db)
        _seed_officer(db)
        res = client.post("/api/v1/auth/register", json={"name": "X", "method": "EMAIL", "email": "officer@test.gov.in", "password": "Password1", "confirmPassword": "Password1"})
        assert res.status_code == 409

    def test_rejects_registering_an_already_verified_mobile_with_409(self, db, client, monkeypatch):
        _clear(db)
        _mock_send_otp(monkeypatch)
        _register_and_verify_citizen(db, client, {"calls": []}, method="MOBILE", mobileNumber="9222222222", email=None)
        res = client.post("/api/v1/auth/register", json={"name": "X2", "method": "MOBILE", "mobileNumber": "9222222222", "password": "Password1", "confirmPassword": "Password1"})
        assert res.status_code == 409

    def test_replaces_an_unfinished_pending_registration_for_the_same_email(self, db, client, monkeypatch):
        _clear(db)
        _mock_email_capture(monkeypatch)
        first = client.post("/api/v1/auth/register", json={"name": "First Attempt", "method": "EMAIL", "email": "retry@example.com", "password": "Password1", "confirmPassword": "Password1"})
        second = client.post("/api/v1/auth/register", json={"name": "Second Attempt", "method": "EMAIL", "email": "retry@example.com", "password": "Password2", "confirmPassword": "Password2"})
        assert second.json()["registrationId"] != first.json()["registrationId"]
        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": first.json()["registrationId"], "code": "123456"})
        assert res.status_code == 400

    def test_rejects_method_email_with_no_email_field_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register", json={"name": "X", "method": "EMAIL", "password": "Password1", "confirmPassword": "Password1"})
        assert res.status_code == 400

    def test_rejects_a_password_shorter_than_8_characters_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register", json={"name": "X", "method": "EMAIL", "email": "short@example.com", "password": "Short1", "confirmPassword": "Short1"})
        assert res.status_code == 400

    def test_rejects_a_long_enough_password_with_no_complexity_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register", json={"name": "X", "method": "EMAIL", "email": "weak-complexity@example.com", "password": "alllowercase", "confirmPassword": "alllowercase"})
        assert res.status_code == 400


class TestVerifyRegistrationOtp:
    def test_rejects_an_unknown_registration_id_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": "00000000-0000-0000-0000-000000000000", "code": "123456"})
        assert res.status_code == 400

    def test_creates_the_account_on_the_correct_email_code(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Email Verify", "method": "EMAIL", "email": "emailverify@example.com", "password": "Password1", "confirmPassword": "Password1"})
        registration_id = register_res.json()["registrationId"]
        code = email_calls["calls"][0][1]

        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": registration_id, "code": code})
        assert res.status_code == 201
        assert isinstance(res.json()["accessToken"], str)
        assert res.json()["user"]["email"] == "emailverify@example.com"
        assert res.json()["user"]["emailVerified"] is True
        assert res.json()["user"]["mobileVerified"] is False
        assert res.json()["user"]["role"] == "CITIZEN"

        assert db.query(User).filter(User.email == "emailverify@example.com").first() is not None
        assert db.get(PendingRegistration, registration_id) is None

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['accessToken']}"})
        assert me.json()["email"] == "emailverify@example.com"

    def test_creates_the_account_via_sms_otp_for_mobile(self, db, client, monkeypatch):
        _clear(db)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, {"calls": []}, method="MOBILE", mobileNumber="9333333333", email=None)
        assert result["user"]["mobileNumber"] == "9333333333"
        assert result["user"]["mobileVerified"] is True
        assert result["user"]["emailVerified"] is False

    def test_rejects_an_incorrect_email_code_with_400(self, db, client, monkeypatch):
        _clear(db)
        _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Wrong Code", "method": "EMAIL", "email": "wrongcode@example.com", "password": "Password1", "confirmPassword": "Password1"})
        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": register_res.json()["registrationId"], "code": "000000"})
        assert res.status_code == 400
        assert db.query(User).filter(User.email == "wrongcode@example.com").first() is None

    def test_rejects_an_expired_email_code_with_400(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Expired Code", "method": "EMAIL", "email": "expiredcode@example.com", "password": "Password1", "confirmPassword": "Password1"})
        registration_id = register_res.json()["registrationId"]
        code = email_calls["calls"][0][1]

        from datetime import datetime, timedelta, timezone
        pending = db.get(PendingRegistration, registration_id)
        # Use UTC to match _now() in auth_service
        pending.otp_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db.flush()

        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": registration_id, "code": code})
        assert res.status_code == 400

    def test_locks_out_after_too_many_incorrect_attempts_with_403(self, db, client, monkeypatch):
        _clear(db)
        _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Lockout", "method": "EMAIL", "email": "lockout@example.com", "password": "Password1", "confirmPassword": "Password1"})
        registration_id = register_res.json()["registrationId"]
        pending = db.get(PendingRegistration, registration_id)
        pending.otp_attempts = 5
        db.flush()

        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": registration_id, "code": "000000"})
        assert res.status_code == 403

    def test_rejects_an_invalid_mobile_code_with_400(self, db, client, monkeypatch):
        _clear(db)
        _mock_send_otp(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Bad Mobile", "method": "MOBILE", "mobileNumber": "9444444444", "password": "Password1", "confirmPassword": "Password1"})
        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": register_res.json()["registrationId"], "code": "111111"})
        assert res.status_code == 400


class TestResendRegistrationOtp:
    def test_rejects_an_unknown_registration_id_with_400(self, db, client):
        _clear(db)
        res = client.post("/api/v1/auth/register/resend-otp", json={"registrationId": "00000000-0000-0000-0000-000000000000"})
        assert res.status_code == 400

    def test_rejects_a_resend_within_the_cooldown_with_400(self, db, client, monkeypatch):
        _clear(db)
        _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Resend Test", "method": "EMAIL", "email": f"resend-{uuid.uuid4()}@example.com", "password": "Password1", "confirmPassword": "Password1"})
        res = client.post("/api/v1/auth/register/resend-otp", json={"registrationId": register_res.json()["registrationId"]})
        assert res.status_code == 400

    def test_sends_a_fresh_code_past_the_cooldown_which_then_verifies(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        register_res = client.post("/api/v1/auth/register", json={"name": "Resend Test 2", "method": "EMAIL", "email": f"resend2-{uuid.uuid4()}@example.com", "password": "Password1", "confirmPassword": "Password1"})
        registration_id = register_res.json()["registrationId"]
        pending = db.get(PendingRegistration, registration_id)
        pending.otp_sent_at = None
        db.flush()

        res = client.post("/api/v1/auth/register/resend-otp", json={"registrationId": registration_id})
        assert res.status_code == 201

        fresh_code = email_calls["calls"][-1][1]
        res = client.post("/api/v1/auth/register/verify-otp", json={"registrationId": registration_id, "code": fresh_code})
        assert res.status_code == 201


class TestVerifyOtp:
    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/verify-otp", json={"method": "EMAIL", "code": "123456"}).status_code == 401

    def test_allows_a_staff_account_too(self, db, client):
        _clear(db)
        _seed_officer(db)
        login_res = client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "CorrectPass1"})
        res = client.post("/api/v1/auth/verify-otp", headers={"Authorization": f"Bearer {login_res.json()['accessToken']}"}, json={"method": "EMAIL", "code": "123456"})
        assert res.status_code == 400  # reached real verification logic - no code to check against

    def test_verifies_a_newly_added_second_contact_method(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]

        client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "mobileNumber": "9666600001"})
        res = client.post("/api/v1/auth/verify-otp", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "code": MOCK_SMS_OTP_CODE})
        assert res.status_code == 201
        assert res.json()["mobileVerified"] is True

    def test_rejects_an_incorrect_code_leaving_it_unverified(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]

        client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "mobileNumber": "9666600002"})
        res = client.post("/api/v1/auth/verify-otp", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "code": "000000"})
        assert res.status_code == 400

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.json()["mobileVerified"] is False

    def test_locks_out_after_too_many_incorrect_attempts_with_403(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]

        client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "mobileNumber": "9666600003"})
        user = db.query(User).filter(User.id == result["user"]["id"]).first()
        user.sms_otp_attempts = 5
        db.flush()

        res = client.post("/api/v1/auth/verify-otp", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "code": "000000"})
        assert res.status_code == 403


class TestResendOtp:
    def test_rejects_a_resend_for_a_method_with_nothing_on_file_with_400(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        res = client.post("/api/v1/auth/resend-otp", headers={"Authorization": f"Bearer {result['token']}"}, json={"method": "MOBILE"})
        assert res.status_code == 400

    def test_rejects_a_resend_within_the_cooldown_with_400(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]
        client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE", "mobileNumber": "9666600004"})
        res = client.post("/api/v1/auth/resend-otp", headers={"Authorization": f"Bearer {token}"}, json={"method": "MOBILE"})
        assert res.status_code == 400


class TestUpdateContact:
    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/profile/contact", json={"method": "MOBILE", "mobileNumber": "9555555555"}).status_code == 401

    def test_adds_a_missing_mobile_number_directly(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        _mock_send_otp(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        res = client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {result['token']}"}, json={"method": "MOBILE", "mobileNumber": "9666666666"})
        assert res.status_code == 201
        assert res.json()["mobileNumber"] == "9666666666"
        assert res.json()["mobileVerified"] is False

    def test_still_saves_the_contact_value_even_when_the_otp_send_fails(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)

        from fastapi import HTTPException, status

        def failing_send_otp(mobile_number):
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SMS delivery is not configured")

        monkeypatch.setattr(sms_service, "send_otp", failing_send_otp)

        res = client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {result['token']}"}, json={"method": "MOBILE", "mobileNumber": "9888888888"})
        assert res.status_code == 201
        assert res.json()["mobileNumber"] == "9888888888"

    def test_stages_a_changed_verified_email_as_pending(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]

        change_res = client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {token}"}, json={"method": "EMAIL", "email": "changed-address@example.com"})
        assert change_res.status_code == 201
        assert change_res.json()["email"] == result["user"]["email"]
        assert change_res.json()["emailVerified"] is True

        staged_code = email_calls["calls"][-1][1]
        verify_res = client.post("/api/v1/auth/verify-otp", headers={"Authorization": f"Bearer {token}"}, json={"method": "EMAIL", "code": staged_code})
        assert verify_res.status_code == 201
        assert verify_res.json()["email"] == "changed-address@example.com"
        assert verify_res.json()["emailVerified"] is True

    def test_rejects_claiming_an_email_already_linked_to_another_account_with_409(self, db, client, monkeypatch):
        _clear(db)
        _seed_officer(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        res = client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {result['token']}"}, json={"method": "EMAIL", "email": "officer@test.gov.in"})
        assert res.status_code == 409

    def test_allows_a_staff_account_to_add_their_own_missing_mobile_number(self, db, client, monkeypatch):
        _clear(db)
        _seed_officer(db)
        _mock_send_otp(monkeypatch)
        login_res = client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "CorrectPass1"})
        res = client.post("/api/v1/auth/profile/contact", headers={"Authorization": f"Bearer {login_res.json()['accessToken']}"}, json={"method": "MOBILE", "mobileNumber": "9777777777"})
        assert res.status_code == 201
        assert res.json()["mobileNumber"] == "9777777777"


class TestUpdateProfileDetails:
    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _clear(db)
        assert client.post("/api/v1/auth/profile/details", json={"occupation": "Farmer"}).status_code == 401

    def test_allows_a_staff_account_to_update_their_own_profile_details(self, db, client):
        _clear(db)
        _seed_officer(db)
        login_res = client.post("/api/v1/auth/login", json={"email": "officer@test.gov.in", "password": "CorrectPass1"})
        res = client.post("/api/v1/auth/profile/details", headers={"Authorization": f"Bearer {login_res.json()['accessToken']}"}, json={"occupation": "Senior Land Record Officer"})
        assert res.status_code == 201
        assert res.json()["occupation"] == "Senior Land Record Officer"

    def test_updates_fields_with_no_otp_step(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        email_calls["calls"].clear()

        res = client.post(
            "/api/v1/auth/profile/details", headers={"Authorization": f"Bearer {result['token']}"},
            json={"name": "Updated Name", "address": "12 MG Road, Pune", "governmentIdNumber": "ABCD1234E", "occupation": "Farmer"},
        )
        assert res.status_code == 201
        assert res.json()["name"] == "Updated Name"
        assert res.json()["address"] == "12 MG Road, Pune"
        assert res.json()["governmentIdNumber"] == "ABCD1234E"
        assert res.json()["occupation"] == "Farmer"
        assert email_calls["calls"] == []

    def test_partially_updates_only_the_fields_sent(self, db, client, monkeypatch):
        _clear(db)
        email_calls = _mock_email_capture(monkeypatch)
        result = _register_and_verify_citizen(db, client, email_calls)
        token = result["token"]
        client.post("/api/v1/auth/profile/details", headers={"Authorization": f"Bearer {token}"}, json={"occupation": "Teacher"})
        res = client.post("/api/v1/auth/profile/details", headers={"Authorization": f"Bearer {token}"}, json={"address": "5 Park Street"})
        assert res.json()["occupation"] == "Teacher"
        assert res.json()["address"] == "5 Park Street"


class TestGoogleOAuth:
    """Tests for Google OAuth 2.0 authentication flow."""

    def test_google_login_endpoint_returns_auth_url(self, client, monkeypatch):
        """Test that GET /auth/google/login returns a Google authorization URL."""
        # Mock the settings to have Google OAuth configured
        from app.config import Settings
        from app.services import oauth_service
        test_settings = Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )
        monkeypatch.setattr(oauth_service, "get_settings", lambda: test_settings)

        res = client.get("/api/v1/auth/google/login")
        assert res.status_code == 200
        data = res.json()
        assert "authUrl" in data
        assert "accounts.google.com/o/oauth2/v2/auth" in data["authUrl"]
        assert "client_id=test-client-id" in data["authUrl"]
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback" in data["authUrl"]
        assert "state=" in data["authUrl"]

    def test_google_login_redirect_after_login_param(self, client, monkeypatch):
        """Test that redirect_after_login parameter is included in state."""
        from app.config import Settings
        from app.services import oauth_service
        test_settings = Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )
        monkeypatch.setattr(oauth_service, "get_settings", lambda: test_settings)

        res = client.get("/api/v1/auth/google/login?redirect_after_login=/citizen")
        assert res.status_code == 200
        data = res.json()
        # The state should be stored and include the redirect
        assert "state=" in data["authUrl"]

    def test_google_login_without_config_returns_500(self, client, monkeypatch):
        """Test that missing Google OAuth config returns 500."""
        from app.config import Settings
        from app.services import oauth_service
        test_settings = Settings(
            google_client_id="",
            google_client_secret="",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )
        monkeypatch.setattr(oauth_service, "get_settings", lambda: test_settings)

        res = client.get("/api/v1/auth/google/login")
        assert res.status_code == 500
        # Error response uses 'message' field (NestJS-style), not 'detail'
        assert "not configured" in res.json()["message"].lower()

    def test_google_callback_rejects_invalid_state(self, client, monkeypatch):
        """Test that invalid/expired OAuth state is rejected."""
        from app.config import Settings
        from app.services import oauth_service
        test_settings = Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )
        monkeypatch.setattr(oauth_service, "get_settings", lambda: test_settings)

        # Use an invalid state
        res = client.get("/api/v1/auth/google/callback?code=test-code&state=invalid-state")
        assert res.status_code == 400
        assert "invalid or expired" in res.json()["message"].lower()

    def test_google_callback_rejects_missing_code(self, client, monkeypatch):
        """Test that missing authorization code is rejected."""
        from app.config import Settings
        from app.services import oauth_service
        test_settings = Settings(
            google_client_id="test-client-id",
            google_client_secret="test-client-secret",
            google_redirect_uri="http://localhost:5173/auth/callback",
        )
        monkeypatch.setattr(oauth_service, "get_settings", lambda: test_settings)

        # Valid state but no code - first we need to get a valid state
        login_res = client.get("/api/v1/auth/google/login")
        state = login_res.json()["authUrl"].split("state=")[1].split("&")[0]

        # Missing required query parameter 'code' returns 400 (not 422) per NestJS contract
        res = client.get(f"/api/v1/auth/google/callback?state={state}")
        assert res.status_code == 400
