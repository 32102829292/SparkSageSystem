from fastapi import APIRouter, Depends
from api.deps import get_current_user
import db

router = APIRouter()


@router.get("")
async def list_conversations(user: dict = Depends(get_current_user)):
    channels = await db.list_channels()
    normalized = []
    for ch in channels:
        last_msg = ch.get("last_message")
        normalized.append({
            "channel_id": ch.get("channel_id"),
            "message_count": ch.get("message_count", 0),
            "last_activity": last_msg.isoformat() if last_msg else None,
        })
    return {"channels": normalized}


@router.get("/{channel_id}")
async def get_conversation(channel_id: str, user: dict = Depends(get_current_user)):
    messages = await db.get_messages(channel_id, limit=100)
    normalized = []
    for m in messages:
        normalized.append({
            "role": m.get("role"),
            "content": m.get("content"),
            "provider": m.get("provider"),
            "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        })
    return {"channel_id": channel_id, "messages": normalized}


@router.delete("/{channel_id}")
async def delete_conversation(channel_id: str, user: dict = Depends(get_current_user)):
    await db.clear_messages(channel_id)
    return {"status": "ok"}