from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
from bot import get_bot
import logging

logger = logging.getLogger('sparksage')
router = APIRouter(prefix="/api/bot", tags=["bot"])


@router.get("/guilds")
async def get_bot_guilds(user=Depends(get_current_user)):
    """Get all guilds the bot is connected to"""
    try:
        bot = get_bot()
        if not bot or not bot.is_ready():
            return {"guilds": []}
        
        guilds = []
        for guild in bot.guilds:
            guilds.append({
                "id": str(guild.id),
                "name": guild.name,
                "member_count": guild.member_count,
                "icon_url": str(guild.icon.url) if guild.icon else None
            })
        
        return {"guilds": guilds}
    except Exception as e:
        logger.error(f"Error fetching guilds: {e}")
        return {"guilds": []}


@router.get("/guilds/{guild_id}/channels")
async def get_guild_channels(guild_id: str, user=Depends(get_current_user)):
    """Get all text channels in a specific guild"""
    try:
        bot = get_bot()
        if not bot or not bot.is_ready():
            return []
        
        guild = bot.get_guild(int(guild_id))
        if not guild:
            return []
        
        channels = []
        for channel in guild.channels:
            # Only include text channels (type 0)
            if channel.type == 0:
                channels.append({
                    "id": str(channel.id),
                    "name": channel.name,
                    "type": channel.type
                })
        
        return channels
    except Exception as e:
        logger.error(f"Error fetching channels for guild {guild_id}: {e}")
        return []


@router.get("/status")
async def get_bot_status(user=Depends(get_current_user)):
    """Get bot status"""
    from bot import get_bot_status as bot_status
    return bot_status()