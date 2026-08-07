"""FastAPI router: AI chat assistant endpoint."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from prisma import Prisma

from app.database import get_db
from app.services.chat_service import get_chat_reply

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    restaurant_id: Optional[uuid.UUID] = None
    history: List[ChatTurn] = []


class ChatResponse(BaseModel):
    reply: str


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Prisma = Depends(get_db)):
    """
    Ask the AI assistant a question about review/reputation data. Pass
    restaurant_id to scope the answer to one outlet, or omit it for a
    platform-wide view across all active outlets.
    """
    reply = await get_chat_reply(
        message=payload.message,
        restaurant_id=str(payload.restaurant_id) if payload.restaurant_id else None,
        history=[turn.model_dump() for turn in payload.history],
        db=db,
    )
    return ChatResponse(reply=reply)