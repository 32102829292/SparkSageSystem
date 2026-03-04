from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
from pydantic import BaseModel
import db
import logging

logger = logging.getLogger('sparksage')
router = APIRouter()


class SetPromptRequest(BaseModel):
    guild_id: str
    prompt: str


@router.get("/guild/{guild_id}")
async def get_guild_prompts(guild_id: str, user=Depends(get_current_user)):
    """Get all custom prompts for a guild."""
    try:
        pool = await db.get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT channel_id, system_prompt FROM channel_prompts WHERE guild_id = $1",
                guild_id
            )
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching guild prompts: {e}")
        return []


@router.get("/channel/{channel_id}")
async def get_channel_prompt(channel_id: str, user=Depends(get_current_user)):
    """Get prompt for a specific channel."""
    try:
        prompt = await db.get_channel_prompt(channel_id)
        return {"prompt": prompt}
    except Exception as e:
        logger.error(f"Error fetching channel prompt: {e}")
        return {"prompt": None}


@router.put("/channel/{channel_id}")
async def set_channel_prompt(
    channel_id: str,
    request: SetPromptRequest,
    user=Depends(get_current_user)
):
    """Set or update a channel prompt."""
    try:
        await db.set_channel_prompt(channel_id, request.guild_id, request.prompt)
        logger.info(f"Saved prompt for channel {channel_id}")
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Error setting channel prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save prompt: {str(e)}")


@router.delete("/channel/{channel_id}")
async def delete_channel_prompt(channel_id: str, user=Depends(get_current_user)):
    """Delete a channel prompt."""
    try:
        await db.delete_channel_prompt(channel_id)
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Error deleting channel prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete prompt")