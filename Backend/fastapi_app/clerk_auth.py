import logging
import os
from typing import Any, Dict, List, Optional

import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL") or "https://api.clerk.com/v1/jwks"
CLERK_JWT_ISSUER = os.getenv("CLERK_JWT_ISSUER")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE")
CLERK_AUTHORIZED_PARTIES = [
    value.strip()
    for value in os.getenv("CLERK_AUTHORIZED_PARTIES", "").split(",")
    if value.strip()
]

_jwks_client = PyJWKClient(CLERK_JWKS_URL)

if not CLERK_JWT_ISSUER:
    logger.warning("CLERK_JWT_ISSUER is not set; issuer validation is disabled.")


def get_session_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()
    return request.cookies.get("__session")


def verify_session_token(token: str) -> Dict[str, Any]:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session token")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        options = {"verify_aud": bool(CLERK_AUDIENCE)}
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_JWT_ISSUER if CLERK_JWT_ISSUER else None,
            audience=CLERK_AUDIENCE if CLERK_AUDIENCE else None,
            options=options,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session token expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token") from exc

    if CLERK_AUTHORIZED_PARTIES:
        azp = payload.get("azp")
        if azp not in CLERK_AUTHORIZED_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized token issuer",
            )

    return payload


def extract_primary_email(payload: Dict[str, Any]) -> Optional[str]:
    for key in ("email", "email_address", "primary_email_address"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    emails = payload.get("email_addresses")
    if isinstance(emails, list) and emails:
        for item in emails:
            if isinstance(item, str) and item.strip():
                return item.strip()
            if isinstance(item, dict):
                email = item.get("email_address") or item.get("email")
                if isinstance(email, str) and email.strip():
                    return email.strip()
    return None


def extract_username(payload: Dict[str, Any]) -> Optional[str]:
    """Prefer the Clerk username claim if present."""
    for key in ("username", "preferred_username"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    # Some Clerk setups include a nested structure
    user_obj = payload.get("user") or payload.get("user_data")
    if isinstance(user_obj, dict):
        value = user_obj.get("username")
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None
