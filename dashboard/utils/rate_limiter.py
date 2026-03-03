"""utils/rate_limiter.py — Sliding window rate limiter"""
import time
from collections import defaultdict
from typing import Tuple, Dict
import config

_user_windows = defaultdict(list)
_guild_windows = defaultdict(list)

WINDOW = config.RATE_LIMIT_WINDOW  # Use from config


def check_rate_limit(guild_id: str, user_id: str, user_limit: int = None, guild_limit: int = None) -> Tuple[bool, str]:
    """Check if request is rate limited. Returns (allowed, message)"""
    user_limit = user_limit or config.RATE_LIMIT_USER
    guild_limit = guild_limit or config.RATE_LIMIT_GUILD
    now = time.time()
    cutoff = now - WINDOW

    # Clean old entries
    key = (guild_id, user_id)
    _user_windows[key] = [t for t in _user_windows[key] if t > cutoff]
    _guild_windows[guild_id] = [t for t in _guild_windows[guild_id] if t > cutoff]

    # Check user limit
    if len(_user_windows[key]) >= user_limit:
        if _user_windows[key]:
            remaining = int(_user_windows[key][0] + WINDOW - now)
        else:
            remaining = WINDOW
        return False, f"⏱️ Rate limit reached. Try again in **{remaining}s**."

    # Check guild limit
    if len(_guild_windows[guild_id]) >= guild_limit:
        if _guild_windows[guild_id]:
            remaining = int(_guild_windows[guild_id][0] + WINDOW - now)
        else:
            remaining = WINDOW
        return False, f"⏱️ Server rate limit reached. Try again in **{remaining}s**."

    # Record this request
    _user_windows[key].append(now)
    _guild_windows[guild_id].append(now)
    return True, ""


def get_user_usage(guild_id: str, user_id: str) -> Dict:
    """Get current usage stats for a user"""
    now = time.time()
    cutoff = now - WINDOW
    key = (guild_id, user_id)
    
    recent = [t for t in _user_windows[key] if t > cutoff]
    return {
        "used": len(recent),
        "remaining": max(0, config.RATE_LIMIT_USER - len(recent)),
        "limit": config.RATE_LIMIT_USER,
        "reset_in": WINDOW
    }


def get_guild_usage(guild_id: str) -> Dict:
    """Get current usage stats for a guild"""
    now = time.time()
    cutoff = now - WINDOW
    
    recent = [t for t in _guild_windows[guild_id] if t > cutoff]
    return {
        "used": len(recent),
        "remaining": max(0, config.RATE_LIMIT_GUILD - len(recent)),
        "limit": config.RATE_LIMIT_GUILD,
        "reset_in": WINDOW
    }


def reset_limits():
    """Reset all rate limits (useful for testing)"""
    _user_windows.clear()
    _guild_windows.clear()