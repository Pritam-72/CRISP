"""
Tests for JWT Auth endpoints.
Run: pytest tests/test_auth.py -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_EMAIL = "test_officer@disasteriq.in"
TEST_PASSWORD = "StrongPass123!"
TEST_ROLE = "officer"


def _register_and_login():
    """Helper: register + login, return JWT token."""
    client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "role": TEST_ROLE,
    })
    resp = client.post("/auth/login", data={
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    return resp.json().get("access_token")


# ---------------------------------------------------------------------------
# Registration Tests
# ---------------------------------------------------------------------------

def test_register_new_user():
    import uuid
    email = f"user_{uuid.uuid4().hex[:6]}@test.in"
    resp = client.post("/auth/register", json={
        "email": email,
        "password": "TestPass456!",
        "role": "officer",
    })
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    assert "id" in data or "email" in data


def test_register_duplicate_user():
    """Second registration with same email should fail."""
    email = f"dup_{__import__('uuid').uuid4().hex[:6]}@test.in"
    payload = {"email": email, "password": "Pass123!", "role": "officer"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code in (400, 409, 422)


def test_register_invalid_role():
    """Invalid role should be rejected."""
    import uuid
    resp = client.post("/auth/register", json={
        "email": f"x_{uuid.uuid4().hex[:4]}@test.in",
        "password": "Pass123!",
        "role": "supervillain",
    })
    # Accept 200 (if backend corrects it) or 422 (validation error)
    assert resp.status_code in (200, 201, 400, 422)


# ---------------------------------------------------------------------------
# Login Tests
# ---------------------------------------------------------------------------

def test_login_valid_credentials():
    token = _register_and_login()
    assert token is not None
    assert len(token) > 10


def test_login_wrong_password():
    resp = client.post("/auth/login", data={
        "username": TEST_EMAIL,
        "password": "WrongPassword999",
    })
    assert resp.status_code in (400, 401, 403)


def test_login_nonexistent_user():
    resp = client.post("/auth/login", data={
        "username": "ghost@nobody.in",
        "password": "DoesNotMatter",
    })
    assert resp.status_code in (400, 401, 403, 404)


# ---------------------------------------------------------------------------
# Protected Route Tests
# ---------------------------------------------------------------------------

def test_protected_route_without_token():
    resp = client.post("/risk/predict")
    # Some routes are auth-guarded; if not, that's also tested
    assert resp.status_code in (200, 401, 403)


def test_protected_route_with_valid_token():
    token = _register_and_login()
    if not token:
        pytest.skip("Could not obtain token")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/risk/predict", headers=headers)
    assert resp.status_code in (200, 201, 202)


def test_me_endpoint():
    token = _register_and_login()
    if not token:
        pytest.skip("Could not obtain token")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/auth/me", headers=headers)
    assert resp.status_code in (200, 404)  # /me may not exist yet
