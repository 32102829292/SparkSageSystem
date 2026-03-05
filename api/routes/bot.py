from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, get_optional_user
import json
import time
import os
import logging

logger = logging.getLogger('sparksage')
router = APIRouter()

STATUS_FILE = "/tmp/bot_status.json"
SIGNAL_FILE = "/tmp/bot_signal.json"
ACTIVITY_FILE = "/tmp/bot_activity.json"
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
    status = _read_status()
    guilds = status.get("guilds", [])
    guild = next((g for g in guilds if g["id"] == guild_id), None)
    if not guild:
        return []
    return guild.get("channels", [])


@router.post("/sync-commands")
async def sync_commands(user=Depends(get_current_user)):
    """
    Signal the bot process to re-sync slash commands with Discord.
    Writes a signal file that the bot's _watch_plugin_signals loop picks up.
    """
    try:
        signal = {
            "action": "sync_commands",
            "ts": time.time(),
        }
        with open(SIGNAL_FILE, "w") as f:
            json.dump(signal, f)
        logger.info("sync-commands signal written")
        return {"status": "ok", "message": "Sync signal sent to bot"}
    except Exception as e:
        logger.error(f"Failed to write sync signal: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send sync signal: {e}")


@router.get("/activity")
async def get_activity(user=Depends(get_current_user)):
    """
    Return recent command activity logged by the bot process.
    The bot writes to ACTIVITY_FILE via log_activity().
    Returns an empty list gracefully if no activity exists yet.
    """
    try:
        if not os.path.exists(ACTIVITY_FILE):
            return []
        with open(ACTIVITY_FILE) as f:
            data = json.load(f)
        # Return most recent 20 entries, newest first
        entries = data if isinstance(data, list) else []
        return sorted(entries, key=lambda x: x.get("timestamp", ""), reverse=True)[:20]
    except Exception as e:
        logger.error(f"Failed to read activity file: {e}")
        return []