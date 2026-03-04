from fastapi import APIRouter, Depends
from api.deps import get_current_user
import db

router = APIRouter()


@router.get("")
async def list_conversations(user: dict = Depends(get_current_user)):
    channels = await db.list_channels()
    normalized = []
    for ch in channels:
        normalized.append({
            "channel_id": ch.get("channel_id"),
            "message_count": ch.get("message_count", 0),
            "last_activity": ch.get("last_activity"),  # already ISO string from db.py
        })
    return {"channels": normalized}


@router.get("/{channel_id}")
async def get_conversation(channel_id: str, user: dict = Depends(get_current_user)):
    messages = await db.get_messages(channel_id, limit=100)
    print("DEBUG first message raw:", messages[0] if messages else "empty")
    normalized = []
    for m in messages:
        normalized.append({
            "role": m.get("role"),
            "content": m.get("content"),
            "provider": m.get("provider"),
            "created_at": m.get("created_at"),
        })
    return {"channel_id": channel_id, "messages": normalized}


@router.delete("/{channel_id}")
async def delete_conversation(channel_id: str, user: dict = Depends(get_current_user)):
    await db.clear_messages(channel_id)
    return {"status": "ok"}
