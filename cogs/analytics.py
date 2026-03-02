"""cogs/analytics.py — /analytics command + usage tracking"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os
from datetime import datetime, timedelta

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")

# Provider pricing per 1M tokens (input, output) in USD
PROVIDER_PRICING = {
    "gemini":      (0.0,    0.0),
    "groq":        (0.0,    0.0),
    "openrouter":  (0.0,    0.0),
    "anthropic":   (3.0,   15.0),
    "openai":      (0.15,   0.60),
}


async def log_event(event_type: str, guild_id: str, channel_id: str, user_id: str,
                    provider: str, command: str = "", latency_ms: int = 0,
                    input_tokens: int = 0, output_tokens: int = 0):
    pricing = PROVIDER_PRICING.get(provider, (0.0, 0.0))
    cost = (input_tokens / 1_000_000 * pricing[0]) + (output_tokens / 1_000_000 * pricing[1])
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("""
                INSERT INTO analytics
                (event_type, guild_id, channel_id, user_id, provider, command,
                 input_tokens, output_tokens, estimated_cost, latency_ms)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (event_type, guild_id, channel_id, user_id, provider, command,
                  input_tokens, output_tokens, cost, latency_ms))
            await db.commit()
    except Exception:
        pass  # Never crash the bot due to analytics


class Analytics(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="analytics", description="View SparkSage usage statistics")
    @app_commands.describe(period="Time period")
    @app_commands.choices(period=[
        app_commands.Choice(name="Today", value="today"),
        app_commands.Choice(name="Last 7 days", value="7d"),
        app_commands.Choice(name="Last 30 days", value="30d"),
        app_commands.Choice(name="All time", value="all"),
    ])
    async def stats(self, interaction: discord.Interaction, period: str = "7d"):
        await interaction.response.defer(thinking=True)

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
        period_labels = {"today": "Today", "7d": "Last 7 Days", "30d": "Last 30 Days", "all": "All Time"}

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            # Try analytics table first, fall back to conversations
            try:
                async with db.execute(f"SELECT COUNT(*) as cnt FROM analytics WHERE 1=1 {where}") as cur:
                    row = await cur.fetchone()
                    total = row["cnt"] if row else 0

                async with db.execute(f"SELECT provider, COUNT(*) as cnt FROM analytics WHERE 1=1 {where} GROUP BY provider ORDER BY cnt DESC") as cur:
                    provider_rows = await cur.fetchall()

                async with db.execute(f"SELECT SUM(estimated_cost) as total_cost FROM analytics WHERE 1=1 {where}") as cur:
                    row = await cur.fetchone()
                    total_cost = round(row["total_cost"] or 0, 4)

            except Exception:
                # Fall back to conversations table
                async with db.execute(f"SELECT COUNT(*) as cnt FROM conversations WHERE 1=1 {where}") as cur:
                    row = await cur.fetchone()
                    total = row["cnt"] if row else 0
                provider_rows = []
                total_cost = 0.0

        embed = discord.Embed(title="📊 SparkSage Statistics", color=discord.Color.blurple())
        embed.add_field(name="Total Events", value=f"**{total}**", inline=True)
        embed.add_field(name="Est. Cost", value=f"**${total_cost}**", inline=True)
        embed.set_footer(text=f"Period: {period_labels.get(period, period)}")

        if provider_rows:
            provider_text = "\n".join(
                f"`{row['provider'] or 'unknown'}` — {row['cnt']}" for row in provider_rows
            )
            embed.add_field(name="By Provider", value=provider_text, inline=False)

        await interaction.followup.send(embed=embed)


async def setup(bot):
    await bot.add_cog(Analytics(bot))