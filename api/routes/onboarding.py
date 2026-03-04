from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from api.deps import get_current_user
import db
import providers
import logging

logger = logging.getLogger("sparksage")
router = APIRouter()


class OnboardingSettings(BaseModel):
    enabled: bool = True
    channel_id: Optional[str] = None
    template: str = ""
    use_ai: bool = True


@router.get("/{guild_id}")
async def get_onboarding(guild_id: str, user=Depends(get_current_user)):
    """Get onboarding settings for a guild."""
    enabled = await db.get_config(f"onboarding_enabled_{guild_id}", "false")
    channel_id = await db.get_config(f"onboarding_channel_id_{guild_id}", "")
    template = await db.get_config(f"onboarding_template_{guild_id}", "")
    use_ai = await db.get_config(f"onboarding_use_ai_{guild_id}", "true")
    return {
        "guild_id": guild_id,
        "enabled": enabled == "true",
        "channel_id": channel_id or None,
        "template": template or "",
        "use_ai": use_ai != "false",
    }


@router.put("/{guild_id}")
async def save_onboarding(guild_id: str, body: OnboardingSettings, user=Depends(get_current_user)):
    """Save onboarding settings for a guild."""
    try:
        await db.set_config(f"onboarding_enabled_{guild_id}", "true" if body.enabled else "false")
        await db.set_config(f"onboarding_channel_id_{guild_id}", body.channel_id or "")
        await db.set_config(f"onboarding_template_{guild_id}", body.template or "")
        await db.set_config(f"onboarding_use_ai_{guild_id}", "true" if body.use_ai else "false")
        logger.info(f"Saved onboarding settings for guild {guild_id}")
        return {"status": "success", "guild_id": guild_id}
    except Exception as e:
        logger.error(f"Failed to save onboarding settings: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")


@router.post("/{guild_id}/preview")
async def preview_onboarding(guild_id: str, body: OnboardingSettings, user=Depends(get_current_user)):
    """Generate a preview of the welcome message."""
    if not body.use_ai and body.template:
        message = body.template
        message = message.replace("{user}", "NewMember")
        message = message.replace("{server}", "Your Server")
        message = message.replace("{mention}", "@NewMember")
        message = message.replace("{count}", "42")
        return {"preview": message}

    try:
        system = "Write a short, friendly 2-sentence welcome message for a new Discord member. Use emojis. Do not use @mentions."
        response, _ = providers.chat(
            [{"role": "user", "content": "Welcome NewMember to 'Your Server'."}],
            system
        )
        return {"preview": response}
    except Exception as e:
        logger.error(f"Preview generation failed: {e}")
        return {"preview": "Welcome to the server, NewMember! 🎉 We're glad to have you here."}