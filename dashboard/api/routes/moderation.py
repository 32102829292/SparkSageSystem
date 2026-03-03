from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user
import db as database
import aiosqlite
import os

router = APIRouter()
DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


class ModerationConfig(BaseModel):
    enabled: bool
    channel_id: str = ""
    sensitivity: str = "medium"


@router.get("")
async def get_moderation(user=Depends(get_current_user)):
    enabled = await database.get_config("moderation_enabled", "false")
    channel_id = await database.get_config("mod_log_channel_id", "")
    sensitivity = await database.get_config("moderation_sensitivity", "medium")
    return {
        "enabled": enabled == "true",
        "channel_id": channel_id or "",
        "sensitivity": sensitivity or "medium",
    }


@router.post("")
async def save_moderation(body: ModerationConfig, user=Depends(get_current_user)):
    await database.set_config("moderation_enabled", "true" if body.enabled else "false")
    await database.set_config("mod_log_channel_id", body.channel_id)
    await database.set_config("moderation_sensitivity", body.sensitivity)
    return {"enabled": body.enabled, "channel_id": body.channel_id, "sensitivity": body.sensitivity}


@router.get("/stats")
async def get_moderation_stats(user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT COUNT(*) as total FROM analytics WHERE event_type='moderation'"
        ) as cur:
            total = (await cur.fetchone())["total"]

        async with db.execute(
            """SELECT command, COUNT(*) as count FROM analytics
               WHERE event_type='moderation'
               GROUP BY SUBSTR(command, 1, INSTR(command, ':') - 1)"""
        ) as cur:
            rows = await cur.fetchall()

    by_severity = {"low": 0, "medium": 0, "high": 0}
    for row in rows:
        cmd = row["command"] or ""
        for sev in by_severity:
            if cmd.startswith(sev):
                by_severity[sev] = row["count"]

    return {"total_flagged": total, "by_severity": by_severity}