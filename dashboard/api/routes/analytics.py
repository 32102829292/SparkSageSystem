from fastapi import APIRouter, Depends
from api.deps import get_current_user
from datetime import datetime, timedelta
import aiosqlite
import os
import db as database

router = APIRouter()
DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


@router.get("/summary")
async def get_analytics_summary(period: str = "7d", user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    if period == "today":
        cutoff = now.replace(hour=0, minute=0, second=0).isoformat()
    elif period == "7d":
        cutoff = (now - timedelta(days=7)).isoformat()
    elif period == "30d":
        cutoff = (now - timedelta(days=30)).isoformat()
    else:
        cutoff = None

    where = f"AND created_at >= '{cutoff}'" if cutoff else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute(f"SELECT COUNT(*) as cnt FROM conversations WHERE 1=1 {where}") as cur:
            row = await cur.fetchone()
            total = row["cnt"] if row else 0

        async with db.execute(f"SELECT COUNT(*) as cnt FROM conversations WHERE role='assistant' {where}") as cur:
            row = await cur.fetchone()
            responses = row["cnt"] if row else 0

        async with db.execute(f"SELECT provider, COUNT(*) as cnt FROM conversations WHERE role='assistant' {where} GROUP BY provider") as cur:
            rows = await cur.fetchall()
            by_provider = {(r["provider"] or "unknown"): r["cnt"] for r in rows}

        async with db.execute(f"SELECT DISTINCT channel_id FROM conversations WHERE 1=1 {where}") as cur:
            rows = await cur.fetchall()
            active_channels = len(rows)

        daily = []
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            async with db.execute(
                "SELECT COUNT(*) as cnt FROM conversations WHERE created_at BETWEEN ? AND ?",
                (f"{day}T00:00:00", f"{day}T23:59:59")
            ) as cur:
                row = await cur.fetchone()
                daily.append({"date": day[5:], "count": row["cnt"] if row else 0})

    return {
        "period": period,
        "total_messages": total,
        "total_responses": responses,
        "active_channels": active_channels,
        "avg_latency_ms": 0,
        "by_provider": by_provider,
        "daily": daily,
    }


@router.get("/costs")
async def get_costs(period: str = "30d", user: dict = Depends(get_current_user)):
    return await database.get_cost_summary(period)