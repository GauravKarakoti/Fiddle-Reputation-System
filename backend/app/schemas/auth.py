"""Pydantic schemas for authentication endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    is_approved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    """
    Register can return one of two shapes:
    - pending=True, access_token=None: the normal case — account created,
      awaiting admin approval, no token issued yet.
    - pending=False, access_token set: only for the very first user ever
      created in an empty database, who is auto-approved as admin so there's
      at least one account able to approve everyone else.
    """
    message: str
    pending: bool
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse