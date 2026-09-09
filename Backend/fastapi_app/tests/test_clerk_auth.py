from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import clerk_auth


def test_token_verification_fails_closed_when_clerk_is_not_scoped(monkeypatch):
    monkeypatch.setattr(clerk_auth, "CLERK_JWKS_URL", "https://clerk.example/jwks")
    monkeypatch.setattr(clerk_auth, "CLERK_JWT_ISSUER", "https://clerk.example")
    monkeypatch.setattr(clerk_auth, "CLERK_AUDIENCE", None)
    monkeypatch.setattr(clerk_auth, "CLERK_AUTHORIZED_PARTIES", [])
    monkeypatch.setattr(clerk_auth, "_jwks_client", SimpleNamespace())

    with pytest.raises(HTTPException) as exc:
        clerk_auth.verify_session_token("token")

    assert exc.value.status_code == 503
    assert exc.value.detail == "Authentication service is not configured"
