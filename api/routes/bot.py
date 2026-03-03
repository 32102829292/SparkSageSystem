from fastapi import APIRouter, Depends
from api.deps import get_current_user, get_optional_user
from bot import get_bot
import discord
import logging

logger = logging.getLogger('sparksage')
router = APIRouter()


@router.get("/status")
async def bot_status(user=Depends(get_optional_user)):
    """Get bot status - public endpoint"""
    from bot import get_bot_status
    return get_bot_status()


@router.get("/guilds")
async def get_guilds(user=Depends(get_current_user)):
    """Get all guilds the bot is connected to"""
    try:
        bot = get_bot()
        if not bot:
            logger.error("Bot instance not available")
            return {"guilds": []}
        
        if not bot.is_ready():
            logger.warning("Bot is not ready yet")
            return {"guilds": []}
        
        guilds = []
        for guild in bot.guilds:
            guilds.append({
                "id": str(guild.id),
                "name": guild.name,
                "member_count": guild.member_count,
                "icon_url": str(guild.icon.url) if guild.icon else None
            })
        
        logger.info(f"Found {len(guilds)} guilds")
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
            logger.warning(f"Guild {guild_id} not found")
            return []
        
        channels = []
        for channel in guild.channels:
            if channel.type == discord.ChannelType.text:
                channels.append({
                    "id": str(channel.id),
                    "name": channel.name,
                    "type": channel.type.value
                })
        
        logger.info(f"Found {len(channels)} text channels in guild {guild.name}")
        return channels
    except Exception as e:
        logger.error(f"Error fetching channels for guild {guild_id}: {e}")
        return []