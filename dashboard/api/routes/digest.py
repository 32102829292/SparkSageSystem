from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user
import db as database

router = APIRouter()


class DigestConfig(BaseModel):
    enabled: bool
    channel_id: str = ""


@router.get("")
async def get_digest(user=Depends(get_current_user)):
    enabled = await database.get_config("digest_enabled", "false")
    channel_id = await database.get_config("digest_channel_id", "")
    return {"enabled": enabled == "true", "channel_id": channel_id or ""}


@router.post("")
async def save_digest(body: DigestConfig, user=Depends(get_current_user)):
    await database.set_config("digest_enabled", "true" if body.enabled else "false")
    await database.set_config("digest_channel_id", body.channel_id)
    return {"enabled": body.enabled, "channel_id": body.channel_id}