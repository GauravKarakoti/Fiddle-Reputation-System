"""FastAPI router: authentication endpoints (register, login, current user)."""
from fastapi import APIRouter, Depends, HTTPException
from prisma import Prisma

from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse
from app.auth.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserRegister, db: Prisma = Depends(get_db)):
    """Create a new user account. Returns an access token immediately (auto-login on signup)."""
    email = payload.email.lower()
    existing = await db.user.find_first(where={"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = await db.user.create(data={
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
    })
    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user=UserResponse(**user.dict()))


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: Prisma = Depends(get_db)):
    """Authenticate with email + password and return an access token."""
    user = await db.user.find_first(where={"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user=UserResponse(**user.dict()))


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """Return the currently authenticated user, resolved from the bearer token."""
    return UserResponse(**user.dict())


# Note on logout: JWTs are stateless, so there's nothing for the server to
# invalidate — logging out is just the frontend discarding its stored token.
# If you later want server-side logout (e.g. to revoke a token before it
# expires), that needs a token blacklist/allowlist table, which isn't set up
# here since it wasn't part of the current requirement.