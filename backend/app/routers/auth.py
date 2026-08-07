"""FastAPI router: authentication endpoints (register, login, current user, admin approval)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from prisma import Prisma

from app.database import get_db
from app.schemas.auth import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    RegisterResponse, ChangePasswordRequest,
)
from app.auth.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_admin_user,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(payload: UserRegister, db: Prisma = Depends(get_db)):
    """
    Create a new user account.

    New signups start pending (is_approved=False, role="member") and cannot
    log in until an admin approves them — no token is issued at this step.

    Exception: if this is the very first user ever created in an empty
    database, they're auto-approved as "admin" instead, so there's at least
    one account able to approve everyone else. Without this, nobody could
    ever get past the pending state.
    """
    email = payload.email.lower()
    existing = await db.user.find_first(where={"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_count = await db.user.count()
    is_first_user = user_count == 0

    user = await db.user.create(data={
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "admin" if is_first_user else "member",
        "is_approved": is_first_user,
    })

    if is_first_user:
        token = create_access_token(user.id, user.email)
        return RegisterResponse(
            message="Account created as the first admin user. You're logged in.",
            pending=False,
            access_token=token,
            user=UserResponse(**user.dict()),
        )

    return RegisterResponse(
        message="Account created. An admin needs to approve your account before you can log in.",
        pending=True,
        user=UserResponse(**user.dict()),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: Prisma = Depends(get_db)):
    """Authenticate with email + password and return an access token."""
    user = await db.user.find_first(where={"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval")

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user=UserResponse(**user.dict()))


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """Return the currently authenticated user, resolved from the bearer token."""
    return UserResponse(**user.dict())


@router.patch("/change-password", status_code=200)
async def change_password(
    payload: ChangePasswordRequest,
    user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    """
    Change the current user's password. Requires the correct current
    password, so a stolen/left-open session alone isn't enough to lock the
    real owner out — this is the standard "confirm your current password"
    pattern.
    """
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    await db.user.update(
        where={"id": user.id},
        data={"password_hash": hash_password(payload.new_password)},
    )
    return {"message": "Password changed successfully"}


# ── Admin: approval workflow ────────────────────────────────────────────────

@router.get("/pending-users", response_model=list[UserResponse])
async def list_pending_users(
    admin=Depends(get_current_admin_user),
    db: Prisma = Depends(get_db),
):
    """List all accounts awaiting approval. Admin only."""
    pending = await db.user.find_many(where={"is_approved": False}, order={"created_at": "asc"})
    return [UserResponse(**u.dict()) for u in pending]


@router.post("/approve/{user_id}", response_model=UserResponse)
async def approve_user(
    user_id: uuid.UUID,
    admin=Depends(get_current_admin_user),
    db: Prisma = Depends(get_db),
):
    """Approve a pending signup, allowing that account to log in. Admin only."""
    target = await db.user.find_first(where={"id": str(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    updated = await db.user.update(where={"id": str(user_id)}, data={"is_approved": True})
    return UserResponse(**updated.dict())


@router.delete("/reject/{user_id}", status_code=200)
async def reject_user(
    user_id: uuid.UUID,
    admin=Depends(get_current_admin_user),
    db: Prisma = Depends(get_db),
):
    """
    Reject a pending signup. This deletes the account entirely rather than
    keeping a "rejected" record around — if they should be able to sign up
    again with the same email later, this needs to actually free that email
    up, not just mark it as rejected.
    """
    target = await db.user.find_first(where={"id": str(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_approved:
        raise HTTPException(status_code=400, detail="Cannot reject an already-approved user")

    await db.user.delete(where={"id": str(user_id)})
    return {"message": "Signup request rejected and removed"}


# Note on logout: JWTs are stateless, so there's nothing for the server to
# invalidate — logging out is just the frontend discarding its stored token.
# If you later want server-side logout (e.g. to revoke a token before it
# expires), that needs a token blacklist/allowlist table, which isn't set up
# here since it wasn't part of the current requirement.