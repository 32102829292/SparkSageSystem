from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
import aiosqlite
import os
from pydantic import BaseModel
import logging

logger = logging.getLogger('sparksage')
DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")
router = APIRouter()


class SetPromptRequest(BaseModel):
    guild_id: str
    prompt: str


@router.get("/guild/{guild_id}")
async def get_guild_prompts(guild_id: str, user=Depends(get_current_user)):
    """Get all custom prompts for a guild"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT channel_id, system_prompt FROM channel_prompts WHERE guild_id = ?",
                (guild_id,)
            )
            rows = await cursor.fetchall()
            logger.info(f"Found {len(rows)} prompts for guild {guild_id}")
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching guild prompts: {e}")
        return []


@router.get("/channel/{channel_id}")
async def get_channel_prompt(channel_id: str, user=Depends(get_current_user)):
    """Get prompt for a specific channel"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT system_prompt FROM channel_prompts WHERE channel_id = ?",
                (channel_id,)
            )
            row = await cursor.fetchone()
            return {"prompt": row["system_prompt"] if row else None}
    except Exception as e:
        logger.error(f"Error fetching channel prompt: {e}")
        return {"prompt": None}


@router.put("/channel/{channel_id}")
async def set_channel_prompt(
    channel_id: str, 
    request: SetPromptRequest,
    user=Depends(get_current_user)
):
    """Set or update a channel prompt"""
    logger.info(f"Attempting to save prompt for channel {channel_id}")
    logger.info(f"Request data: guild_id={request.guild_id}, prompt={request.prompt[:50]}...")
    
    try:
        # Check if database file exists
        if not os.path.exists(DB_PATH):
            logger.error(f"Database file not found at {DB_PATH}")
            raise HTTPException(status_code=500, detail="Database not found")
        
        async with aiosqlite.connect(DB_PATH) as db:
            # First check if table exists
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='channel_prompts'"
            )
            table = await cursor.fetchone()
            if not table:
                logger.error("channel_prompts table does not exist, creating it now")
                await db.execute('''
                    CREATE TABLE IF NOT EXISTS channel_prompts (
                        channel_id TEXT PRIMARY KEY,
                        guild_id TEXT NOT NULL,
                        system_prompt TEXT NOT NULL
                    )
                ''')
                await db.commit()
            
            # Insert or replace
            await db.execute(
                """INSERT OR REPLACE INTO channel_prompts (channel_id, guild_id, system_prompt) 
                   VALUES (?, ?, ?)""",
                (channel_id, request.guild_id, request.prompt)
            )
            await db.commit()
            
            # Verify it was saved - FIXED: use execute + fetchone instead of execute_fetchone
            cursor = await db.execute(
                "SELECT system_prompt FROM channel_prompts WHERE channel_id = ?",
                (channel_id,)
            )
            verify = await cursor.fetchone()
            
            if verify:
                logger.info(f"✅ Successfully saved prompt for channel {channel_id}")
            else:
                logger.error(f"❌ Failed to verify prompt was saved for channel {channel_id}")
                raise HTTPException(status_code=500, detail="Failed to verify save")
                
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"❌ Error setting channel prompt: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save prompt: {str(e)}")


@router.delete("/channel/{channel_id}")
async def delete_channel_prompt(channel_id: str, user=Depends(get_current_user)):
    """Delete a channel prompt"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "DELETE FROM channel_prompts WHERE channel_id = ?",
                (channel_id,)
            )
            await db.commit()
        logger.info(f"Deleted prompt for channel {channel_id}")
        return {"status": "success", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Error deleting channel prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete prompt")