from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
from utils.rate_limiter import get_user_usage, get_guild_usage, reset_limits
import config
import logging
import time

logger = logging.getLogger('sparksage')

# REMOVED the prefix from here
router = APIRouter()


@router.get("/settings")
async def get_rate_limit_settings(user=Depends(get_current_user)):
    """Get current rate limit settings"""
    return {
        "user_limit": config.RATE_LIMIT_USER,
        "guild_limit": config.RATE_LIMIT_GUILD,
        "window_seconds": config.RATE_LIMIT_WINDOW
    }


@router.get("/user/{guild_id}/{user_id}")
async def get_user_rate_limit(guild_id: str, user_id: str, user=Depends(get_current_user)):
    """Get rate limit usage for a specific user"""
    try:
        usage = get_user_usage(guild_id, user_id)
        return usage
    except Exception as e:
        logger.error(f"Error getting user rate limit: {e}")
        return {
            "used": 0, 
            "remaining": config.RATE_LIMIT_USER, 
            "limit": config.RATE_LIMIT_USER, 
            "reset_in": config.RATE_LIMIT_WINDOW
        }


@router.get("/guild/{guild_id}")
async def get_guild_rate_limit(guild_id: str, user=Depends(get_current_user)):
    """Get rate limit usage for a guild"""
    try:
        usage = get_guild_usage(guild_id)
        return usage
    except Exception as e:
        logger.error(f"Error getting guild rate limit: {e}")
        return {
            "used": 0, 
            "remaining": config.RATE_LIMIT_GUILD, 
            "limit": config.RATE_LIMIT_GUILD, 
            "reset_in": config.RATE_LIMIT_WINDOW
        }


@router.get("/summary/{guild_id}")
async def get_rate_limit_summary(guild_id: str, user=Depends(get_current_user)):
    """Get rate limit summary for a guild with top users"""
    try:
        from utils.rate_limiter import _user_windows
        
        guild_usage = get_guild_usage(guild_id)
        
        # Get top users in this guild
        top_users = []
        for (gid, uid), timestamps in _user_windows.items():
            if gid == guild_id:
                now = time.time()
                cutoff = now - config.RATE_LIMIT_WINDOW
                recent = [t for t in timestamps if t > cutoff]
                if recent:
                    top_users.append({
                        "user_id": uid,
                        "used": len(recent),
                        "remaining": max(0, config.RATE_LIMIT_USER - len(recent))
                    })
        
        # Sort by usage descending
        top_users.sort(key=lambda x: x["used"], reverse=True)
        
        return {
            "guild": guild_usage,
            "top_users": top_users[:10]
        }
    except Exception as e:
        logger.error(f"Error getting rate limit summary: {e}")
        return {
            "guild": {"used": 0, "remaining": config.RATE_LIMIT_GUILD, "limit": config.RATE_LIMIT_GUILD, "reset_in": config.RATE_LIMIT_WINDOW},
            "top_users": []
        }


@router.post("/reset")
async def reset_all_limits(user=Depends(get_current_user)):
    """Reset all rate limits (admin only)"""
    # For now, simple check - you can implement proper admin check later
    if user.get("user_id") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reset_limits()
    logger.warning(f"Rate limits reset by user {user.get('user_id')}")
    return {"status": "success", "message": "All rate limits reset"}


@router.get("/dashboard")
async def get_rate_limit_dashboard_data(guild_id: str, user=Depends(get_current_user)):
    """Get comprehensive rate limit data for dashboard display"""
    try:
        guild_usage = get_guild_usage(guild_id)
        
        guild_percentage = (guild_usage["used"] / guild_usage["limit"]) * 100 if guild_usage["limit"] > 0 else 0
        
        if guild_percentage >= 90:
            status = "critical"
            color = "red"
        elif guild_percentage >= 70:
            status = "warning"
            color = "yellow"
        else:
            status = "healthy"
            color = "green"
        
        return {
            "guild": {
                **guild_usage,
                "percentage": round(guild_percentage, 1),
                "status": status,
                "color": color
            },
            "settings": {
                "user_limit": config.RATE_LIMIT_USER,
                "guild_limit": config.RATE_LIMIT_GUILD,
                "window_minutes": config.RATE_LIMIT_WINDOW // 60
            }
        }
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return {
            "guild": {
                "used": 0,
                "remaining": config.RATE_LIMIT_GUILD,
                "limit": config.RATE_LIMIT_GUILD,
                "reset_in": config.RATE_LIMIT_WINDOW,
                "percentage": 0,
                "status": "healthy",
                "color": "green"
            },
            "settings": {
                "user_limit": config.RATE_LIMIT_USER,
                "guild_limit": config.RATE_LIMIT_GUILD,
                "window_minutes": config.RATE_LIMIT_WINDOW // 60
            }
        }