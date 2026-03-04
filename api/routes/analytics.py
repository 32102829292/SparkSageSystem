from fastapi import APIRouter, Depends
from api.deps import get_current_user
from datetime import datetime, timedelta, timezone
import db as database
import logging

logger = logging.getLogger("sparksage")
router = APIRouter()


def _get_cutoff(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7d":
        return now - timedelta(days=7)
    elif period == "30d":
        return now - timedelta(days=30)
    return None  # "all"


@router.get("/summary")
async def get_analytics_summary(period: str = "7d", user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    cutoff = _get_cutoff(period)

    try:
        pool = await database.get_db()
        async with pool.acquire() as conn:
            if cutoff:
                total_row = await conn.fetchrow(
                    "SELECT COUNT(*) as cnt FROM conversations WHERE created_at >= $1", cutoff
                )
                resp_row = await conn.fetchrow(
                    "SELECT COUNT(*) as cnt FROM conversations WHERE role='assistant' AND created_at >= $1", cutoff
                )
                provider_rows = await conn.fetch(
                    "SELECT provider, COUNT(*) as cnt FROM conversations WHERE role='assistant' AND created_at >= $1 GROUP BY provider",
                    cutoff
                )
                channel_rows = await conn.fetch(
                    "SELECT DISTINCT channel_id FROM conversations WHERE created_at >= $1", cutoff
                )
            else:
                total_row = await conn.fetchrow("SELECT COUNT(*) as cnt FROM conversations")
                resp_row = await conn.fetchrow("SELECT COUNT(*) as cnt FROM conversations WHERE role='assistant'")
                provider_rows = await conn.fetch(
                    "SELECT provider, COUNT(*) as cnt FROM conversations WHERE role='assistant' GROUP BY provider"
                )
                channel_rows = await conn.fetch("SELECT DISTINCT channel_id FROM conversations")

            total = total_row["cnt"] if total_row else 0
            responses = resp_row["cnt"] if resp_row else 0
            by_provider = {(r["provider"] or "unknown"): r["cnt"] for r in provider_rows}
            active_channels = len(channel_rows)

            # Daily breakdown — use proper datetime objects, not strings
            daily = []
            for i in range(6, -1, -1):
                day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                row = await conn.fetchrow(
                    "SELECT COUNT(*) as cnt FROM conversations WHERE created_at >= $1 AND created_at < $2",
                    day_start, day_end
                )
                daily.append({
                    "date": day_start.strftime("%m-%d"),
                    "count": row["cnt"] if row else 0
                })

    except Exception as e:
        logger.error(f"Analytics query failed: {e}")
        return {
            "period": period,
            "total_messages": 0,
            "total_responses": 0,
            "active_channels": 0,
            "avg_latency_ms": 0,
            "by_provider": {},
            "daily": [],
            "error": str(e),
        }

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
    """Cost summary shaped to match the frontend CostSummary interface."""
    now = datetime.now(timezone.utc)
    cutoff = _get_cutoff(period)

    try:
        pool = await database.get_db()
        async with pool.acquire() as conn:
            # Totals
            if cutoff:
                totals = await conn.fetchrow(
                    """SELECT COALESCE(SUM(estimated_cost),0) as total_cost,
                              COALESCE(SUM(input_tokens),0) as input_tokens,
                              COALESCE(SUM(output_tokens),0) as output_tokens
                       FROM analytics WHERE created_at >= $1""", cutoff
                )
                provider_rows = await conn.fetch(
                    """SELECT provider,
                              COALESCE(SUM(estimated_cost),0) as cost,
                              COALESCE(SUM(input_tokens),0) as input_tokens,
                              COALESCE(SUM(output_tokens),0) as output_tokens
                       FROM analytics WHERE created_at >= $1
                       GROUP BY provider ORDER BY cost DESC""", cutoff
                )
            else:
                totals = await conn.fetchrow(
                    """SELECT COALESCE(SUM(estimated_cost),0) as total_cost,
                              COALESCE(SUM(input_tokens),0) as input_tokens,
                              COALESCE(SUM(output_tokens),0) as output_tokens
                       FROM analytics"""
                )
                provider_rows = await conn.fetch(
                    """SELECT provider,
                              COALESCE(SUM(estimated_cost),0) as cost,
                              COALESCE(SUM(input_tokens),0) as input_tokens,
                              COALESCE(SUM(output_tokens),0) as output_tokens
                       FROM analytics
                       GROUP BY provider ORDER BY cost DESC"""
                )

            # Daily breakdown
            days = 30 if period == "30d" else 7
            daily = []
            for i in range(days - 1, -1, -1):
                day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                row = await conn.fetchrow(
                    "SELECT COALESCE(SUM(estimated_cost),0) as cost FROM analytics WHERE created_at >= $1 AND created_at < $2",
                    day_start, day_end
                )
                daily.append({"date": day_start.strftime("%m-%d"), "cost": float(row["cost"] or 0)})

        total_cost = float(totals["total_cost"] or 0)

        # Project monthly cost from current period
        elapsed_days = (now - cutoff).days if cutoff else 30
        projected_monthly = (total_cost / max(elapsed_days, 1)) * 30 if total_cost > 0 else 0.0

        by_provider = [
            {
                "name": r["provider"] or "unknown",
                "cost": float(r["cost"] or 0),
                "input_tokens": int(r["input_tokens"] or 0),
                "output_tokens": int(r["output_tokens"] or 0),
            }
            for r in provider_rows
        ]

        return {
            "total_cost": round(total_cost, 6),
            "projected_monthly": round(projected_monthly, 6),
            "total_input_tokens": int(totals["input_tokens"] or 0),
            "total_output_tokens": int(totals["output_tokens"] or 0),
            "by_provider": by_provider,
            "daily": daily,
        }
    except Exception as e:
        logger.error(f"Cost summary failed: {e}")
        return {
            "total_cost": 0.0,
            "projected_monthly": 0.0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "by_provider": [],
            "daily": [],
        }