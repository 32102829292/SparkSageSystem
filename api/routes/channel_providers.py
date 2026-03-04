from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
from pydantic import BaseModel
import db
import logging

logger = logging.getLogger('sparksage')
router = APIRouter()


class SetProviderRequest(BaseModel):
    guild_id: str
    provider: str


@router.get("/guild/{guild_id}")
async def get_guild_providers(guild_id: str, user=Depends(get_current_user)):
    """Get all provider overrides for a guild."""
    try:
        pool = await db.get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT channel_id, provider FROM channel_providers WHERE guild_id = $1",
                guild_id
            )
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching guild providers: {e}")
        return []


@router.get("/channel/{channel_id}")
async def get_channel_provider(channel_id: str, user=Depends(get_current_user)):
    """Get provider override for a specific channel."""
    try:
        provider = await db.get_channel_provider(channel_id)
        return {"channel_id": channel_id, "provider": provider}
    except Exception as e:
        logger.error(f"Error fetching channel provider: {e}")
        return {"channel_id": channel_id, "provider": None}


@router.put("/channel/{channel_id}")
async def set_channel_provider(
    channel_id: str,
    request: SetProviderRequest,
    user=Depends(get_current_user)
):
    """Set or update a channel provider override."""
    try:
        await db.set_channel_provider(channel_id, request.guild_id, request.provider)
        return {"status": "success", "channel_id": channel_id, "provider": request.provider}
    except Exception as e:
        logger.error(f"Error setting channel provider: {e}")
        raise HTTPException(status_code=500, detail="Failed to save provider override")


@router.delete("/channel/{channel_id}")
async def delete_channel_provider(channel_id: str, user=Depends(get_current_user)):
    """Delete a channel provider override."""
    try:
        await db.delete_channel_provider(channel_id)
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Error deleting channel provider: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete provider override")


@router.get("/providers/list")
async def list_providers(user=Depends(get_current_user)):
    """List all available providers."""
    return ["gemini", "groq", "openrouter", "anthropic", "openai"]