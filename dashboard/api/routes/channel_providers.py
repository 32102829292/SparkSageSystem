from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
import aiosqlite
import os
from pydantic import BaseModel
import logging

logger = logging.getLogger('sparksage')
DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")
router = APIRouter()


class SetProviderRequest(BaseModel):
    guild_id: str
    provider: str


@router.get("/guild/{guild_id}")
async def get_guild_providers(guild_id: str, user=Depends(get_current_user)):
    """Get all provider overrides for a guild"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT channel_id, provider FROM channel_providers WHERE guild_id = ?",
                (guild_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching guild providers: {e}")
        return []


@router.get("/channel/{channel_id}")
async def get_channel_provider(channel_id: str, user=Depends(get_current_user)):
    """Get provider override for a specific channel"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT provider FROM channel_providers WHERE channel_id = ?",
                (channel_id,)
            )
            row = await cursor.fetchone()
            return {"channel_id": channel_id, "provider": row["provider"] if row else None}
    except Exception as e:
        logger.error(f"Error fetching channel provider: {e}")
        return {"channel_id": channel_id, "provider": None}


@router.put("/channel/{channel_id}")
async def set_channel_provider(
    channel_id: str,
    guild_id: str,
    provider: str,
    user=Depends(get_current_user)
):
    """Set or update a channel provider override"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            # Create table if it doesn't exist
            await db.execute('''
                CREATE TABLE IF NOT EXISTS channel_providers (
                    channel_id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    provider TEXT NOT NULL
                )
            ''')
            
            await db.execute(
                """INSERT OR REPLACE INTO channel_providers (channel_id, guild_id, provider) 
                   VALUES (?, ?, ?)""",
                (channel_id, guild_id, provider)
            )
            await db.commit()
        return {"status": "success", "channel_id": channel_id, "provider": provider}
    except Exception as e:
        logger.error(f"Error setting channel provider: {e}")
        raise HTTPException(status_code=500, detail="Failed to save provider override")


@router.delete("/channel/{channel_id}")
async def delete_channel_provider(channel_id: str, user=Depends(get_current_user)):
    """Delete a channel provider override"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "DELETE FROM channel_providers WHERE channel_id = ?",
                (channel_id,)
            )
            await db.commit()
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Error deleting channel provider: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete provider override")


@router.get("/providers/list")
async def list_providers(user=Depends(get_current_user)):
    """List all available providers"""
    return ["gemini", "groq", "openrouter", "anthropic", "openai"]