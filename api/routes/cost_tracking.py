from fastapi import APIRouter, Depends
from api.deps import get_current_user
from datetime import datetime, timedelta, timezone
import db
import logging

logger = logging.getLogger("sparksage")
router = APIRouter()

# Provider pricing per 1M tokens (input, output) in USD
PROVIDER_PRICING = {
    "gemini":     (0.0,   0.0),
    "groq":       (0.0,   0.0),
    "openrouter": (0.0,   0.0),
    "anthropic":  (3.0,  15.0),
    "openai":     (0.15,  0.60),
}


@router.get("/summary")
async def get_cost_summary(period: str = "30d", user=Depends(get_current_user)):
    """Get cost summary by provider for a given period."""
    try:
        return await db.get_cost_summary(period)
    except Exception as e:
        logger.error(f"Cost summary failed: {e}")
        return {"period": period, "total_cost": 0.0, "by_provider": {}}


@router.get("/breakdown")
async def get_cost_breakdown(period: str = "30d", user=Depends(get_current_user)):
    """Get detailed daily cost breakdown."""
    now = datetime.now(timezone.utc)
    days = 30 if period == "30d" else 7 if period == "7d" else 1

    try:
        pool = await db.get_db()
        async with pool.acquire() as conn:
            daily = []
            for i in range(days - 1, -1, -1):
                day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                row = await conn.fetchrow(
                    """SELECT COALESCE(SUM(estimated_cost), 0) as cost,
                              COALESCE(SUM(input_tokens), 0) as input_tokens,
                              COALESCE(SUM(output_tokens), 0) as output_tokens,
                              COUNT(*) as requests
                       FROM analytics
                       WHERE created_at >= $1 AND created_at < $2""",
                    day_start, day_end
                )
                daily.append({
                    "date": day_start.strftime("%m-%d"),
                    "cost": float(row["cost"] or 0),
                    "input_tokens": int(row["input_tokens"] or 0),
                    "output_tokens": int(row["output_tokens"] or 0),
                    "requests": int(row["requests"] or 0),
                })

            # Provider breakdown
            cutoff = now - timedelta(days=days)
            provider_rows = await conn.fetch(
                """SELECT provider,
                          COALESCE(SUM(estimated_cost), 0) as total_cost,
                          COALESCE(SUM(input_tokens), 0) as input_tokens,
                          COALESCE(SUM(output_tokens), 0) as output_tokens,
                          COUNT(*) as requests
                   FROM analytics
                   WHERE created_at >= $1
                   GROUP BY provider
                   ORDER BY total_cost DESC""",
                cutoff
            )
            by_provider = [
                {
                    "provider": r["provider"] or "unknown",
                    "total_cost": float(r["total_cost"] or 0),
                    "input_tokens": int(r["input_tokens"] or 0),
                    "output_tokens": int(r["output_tokens"] or 0),
                    "requests": int(r["requests"] or 0),
                    "is_free": PROVIDER_PRICING.get(r["provider"] or "", (0, 0)) == (0.0, 0.0),
                }
                for r in provider_rows
            ]

            total_cost = sum(p["total_cost"] for p in by_provider)

        return {
            "period": period,
            "total_cost": round(total_cost, 6),
            "daily": daily,
            "by_provider": by_provider,
            "pricing_info": {
                name: {"input_per_1m": p[0], "output_per_1m": p[1], "free": p == (0.0, 0.0)}
                for name, p in PROVIDER_PRICING.items()
            }
        }
    except Exception as e:
        logger.error(f"Cost breakdown failed: {e}")
        return {
            "period": period,
            "total_cost": 0.0,
            "daily": [],
            "by_provider": [],
            "pricing_info": {},
        }