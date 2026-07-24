"""
Password hashing and JWT token utilities for authentication.

Note: no existing route depends on get_current_user yet — the API is
intentionally left open per current requirements. To require login on any
route later, just add `user = Depends(get_current_user)` to its signature.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from prisma import Prisma

from app.config import get_settings
from app.database import get_db

settings = get_settings()

# Calling bcrypt directly rather than via passlib.CryptContext: passlib 1.7.4's
# bcrypt backend runs a self-test on first use that breaks against
# bcrypt>=4.1 ("module 'bcrypt' has no attribute '__about__'", followed by
# "password cannot be longer than 72 bytes" from passlib's internal test
# string). Calling bcrypt's own hashpw/checkpw sidesteps that broken
# self-test entirely.

# HTTPBearer only extracts the "Authorization: Bearer <token>" header when
# present — it doesn't reject requests without one unless a route actually
# depends on get_current_user, so this stays inert until a route opts in.
_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes of input regardless; truncate
    # explicitly so long passwords don't raise instead of just being capped.
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Prisma = Depends(get_db),
):
    """
    FastAPI dependency that resolves the logged-in user from a bearer token.
    Add this as a dependency on any route that should require auth; routes
    that don't reference it remain open, as of this current requirement.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(credentials.credentials)
    user = await db.user.find_first(where={"id": payload["sub"]})
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user