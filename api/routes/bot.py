from fastapi import APIRouter, Depends
from api.deps import get_current_user, get_optional_user
import json
import time
import logging

logger = logging.getLogger('sparksage')
router = APIRouter()

STATUS_FILE = "/tmp/bot_status.json"
STALE_THRESHOLD = 30  # seconds


def _read_status() -> dict:
    """Read bot status written by the bot process."""
    try:
        with open(STATUS_FILE) as f:
            data = json.load(f)
        if time.time() - data.get("timestamp", 0) > STALE_THRESHOLD:
            data["online"] = False
            data["stale"] = True
        return data
    except FileNotFoundError:
        return {"online": False, "username": None, "latency_ms": None, "guild_count": 0, "guilds": []}
    except Exception as e:
        logger.error(f"Error reading bot status file: {e}")
        return {"online": False, "username": None, "latency_ms": None, "guild_count": 0, "guilds": []}


@router.get("/status")
async def bot_status(user=Depends(get_optional_user)):
    """Get bot status - public endpoint."""
    return _read_status()


@router.get("/guilds")
async def get_guilds(user=Depends(get_current_user)):
    """Get all guilds the bot is connected to."""
    status = _read_status()
    return {"guilds": status.get("guilds", [])}


@router.get("/guilds/{guild_id}/channels")
async def get_guild_channels(guild_id: str, user=Depends(get_current_user)):
    """
    Get channels for a guild.
    Since the API and bot are separate processes, we return channels
    cached in the status file. For full channel data, the bot process
    would need to write channel info to the status file or a DB table.
    """
    status = _read_status()
    guilds = status.get("guilds", [])
    guild = next((g for g in guilds if g["id"] == guild_id), None)
    if not guild:
        return []
    # Channel data requires the bot process — return empty with a hint
    # to add channel caching to _write_status_loop in bot.py if needed
    return guild.get("channels", [])