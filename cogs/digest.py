"""cogs/digest.py — Daily digest scheduler"""
import discord
from discord import app_commands
from discord.ext import commands, tasks
import db  # Swapped aiosqlite for your new db.py
import os
import providers
from datetime import datetime, timedelta, timezone

class Digest(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.daily_digest.start()

    def cog_unload(self):
        self.daily_digest.cancel()

    @tasks.loop(hours=24)
    async def daily_digest(self):
        # Using your new db functions instead of local get_setting
        enabled = await db.get_config("digest_enabled")
        if enabled != "true":
            return

        channel_id = await db.get_config("digest_channel_id")
        if not channel_id:
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            return

        # Fetch messages from Supabase (PostgreSQL logic)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # We access the pool directly for this specific time-based query
        pool = await db.get_db()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT role, content FROM conversations WHERE created_at >= $1 ORDER BY created_at ASC",
                cutoff
            )

        if not rows:
            await channel.send("📰 No activity in the past 24 hours to summarize.")
            return

        # PostgreSQL records are accessed like dicts or by name
        conversation = "\n".join(
            f"{r['role'].upper()}: {r['content'][:200]}" for r in rows[:50]
        )
        
        system = (
            "You are a helpful summarizer. Create a concise daily digest of AI assistant "
            "conversations. Use bullet points. Highlight key topics discussed."
        )
        user_msg = f"Summarize these conversations from the past 24 hours:\n\n{conversation}"

        try:
            summary, provider_name = await providers.chat(
                [{"role": "user", "content": user_msg}], system
            )
        except Exception as e:
            summary = f"Could not generate digest: {e}"

        embed = discord.Embed(
            title=f"📰 Daily Digest — {datetime.now(timezone.utc).strftime('%B %d, %Y')}",
            description=summary[:4000],
            color=discord.Color.gold(),
            timestamp=datetime.now(timezone.utc),
        )
        embed.set_footer(text="SparkSage Daily Digest")
        await channel.send(embed=embed)

    @daily_digest.before_loop
    async def before_digest(self):
        await self.bot.wait_until_ready()

    digest_group = app_commands.Group(name="digest", description="Daily digest settings")

    @digest_group.command(name="setup", description="[Admin] Configure daily digest")
    @app_commands.describe(channel="Channel to post daily digest")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def digest_setup(self, interaction: discord.Interaction, channel: discord.TextChannel):
        await db.set_config("digest_channel_id", str(channel.id))
        await db.set_config("digest_enabled", "true")
        await interaction.response.send_message(
            f"✅ Daily digest will be posted to {channel.mention} every 24 hours.",
            ephemeral=True,
        )

    @digest_group.command(name="now", description="[Admin] Post a digest right now")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def digest_now(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        await self.daily_digest()
        await interaction.followup.send("✅ Digest posted!", ephemeral=True)

    @digest_group.command(name="disable", description="[Admin] Disable daily digest")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def digest_disable(self, interaction: discord.Interaction):
        await db.set_config("digest_enabled", "false")
        await interaction.response.send_message("✅ Daily digest disabled.", ephemeral=True)

    @digest_group.command(name="status", description="Check digest configuration")
    async def digest_status(self, interaction: discord.Interaction):
        enabled = await db.get_config("digest_enabled")
        channel_id = await db.get_config("digest_channel_id")
        
        channel = self.bot.get_channel(int(channel_id)) if channel_id else None
        status = "✅ Enabled" if enabled == "true" else "❌ Disabled"
        ch = channel.mention if channel else "Not set"
        
        await interaction.response.send_message(
            f"**Digest Status:** {status}\n**Channel:** {ch}", ephemeral=True
        )

async def setup(bot):
    await bot.add_cog(Digest(bot))