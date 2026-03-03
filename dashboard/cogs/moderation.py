"""cogs/moderation.py — Content moderation pipeline"""
from __future__ import annotations

import json
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os
import providers
import logging

logger = logging.getLogger("sparksage")
DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


async def get_setting(key: str, default: str = "") -> str:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT value FROM config WHERE key=?", (key,)) as cur:
            row = await cur.fetchone()
            return row["value"] if row else default


async def set_setting(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value)
        )
        await db.commit()


async def log_moderation(guild_id: str, channel_id: str, user_id: str, message: str, reason: str, severity: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO analytics (event_type, guild_id, channel_id, user_id, command)
               VALUES ('moderation', ?, ?, ?, ?)""",
            (guild_id, channel_id, user_id, f"{severity}: {reason[:200]}")
        )
        await db.commit()


SEVERITY_COLOR = {
    "low": discord.Color.yellow(),
    "medium": discord.Color.orange(),
    "high": discord.Color.red(),
}

SENSITIVITY_PROMPTS = {
    "low": "Only flag clear hate speech, threats, or illegal content.",
    "medium": "Flag hate speech, threats, spam, and harassment.",
    "high": "Flag any toxic, rude, spammy, or inappropriate content.",
}


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return
        if not message.guild:
            return

        enabled = await get_setting("moderation_enabled", "false")
        if enabled != "true":
            return

        # Skip very short messages
        if len(message.content.strip()) < 10:
            return

        sensitivity = await get_setting("moderation_sensitivity", "medium")
        sensitivity_note = SENSITIVITY_PROMPTS.get(sensitivity, SENSITIVITY_PROMPTS["medium"])

        system = (
            "You are a content moderation assistant. "
            f"{sensitivity_note} "
            "Respond ONLY with valid JSON in this exact format: "
            '{"flagged": true/false, "reason": "short reason", "severity": "low"/"medium"/"high"}'
        )
        user_msg = f"Moderate this message: {message.content[:500]}"

        try:
            response, _ = await providers.chat(
                [{"role": "user", "content": user_msg}], system
            )
            # Strip markdown code fences if present
            clean = response.strip().strip("```json").strip("```").strip()
            result = json.loads(clean)
        except Exception as e:
            logger.warning(f"Moderation check failed: {e}")
            return

        if not result.get("flagged"):
            return

        reason = result.get("reason", "No reason provided")
        severity = result.get("severity", "medium")

        # Log to analytics
        await log_moderation(
            str(message.guild.id),
            str(message.channel.id),
            str(message.author.id),
            message.content,
            reason,
            severity,
        )

        # Post to mod log channel
        mod_channel_id = await get_setting("mod_log_channel_id", "")
        if not mod_channel_id:
            return

        mod_channel = self.bot.get_channel(int(mod_channel_id))
        if not mod_channel:
            return

        embed = discord.Embed(
            title=f"🚨 Message Flagged — {severity.upper()} severity",
            color=SEVERITY_COLOR.get(severity, discord.Color.orange()),
        )
        embed.add_field(name="Author", value=message.author.mention, inline=True)
        embed.add_field(name="Channel", value=message.channel.mention, inline=True)
        embed.add_field(name="Severity", value=severity.capitalize(), inline=True)
        embed.add_field(name="Reason", value=reason, inline=False)
        embed.add_field(
            name="Message",
            value=message.content[:1000] if message.content else "(empty)",
            inline=False,
        )
        embed.add_field(
            name="Jump to Message",
            value=f"[Click here]({message.jump_url})",
            inline=False,
        )
        embed.set_footer(text="SparkSage Moderation — for human review only")

        await mod_channel.send(embed=embed)

    # --- Admin commands ---

    mod_group = app_commands.Group(name="mod", description="Moderation settings")

    @mod_group.command(name="setup", description="[Admin] Configure moderation")
    @app_commands.describe(
        channel="Channel to post moderation alerts",
        sensitivity="Moderation sensitivity: low, medium, high",
    )
    @app_commands.choices(sensitivity=[
        app_commands.Choice(name="Low — only serious violations", value="low"),
        app_commands.Choice(name="Medium — balanced (recommended)", value="medium"),
        app_commands.Choice(name="High — flag anything borderline", value="high"),
    ])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def mod_setup(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        sensitivity: str = "medium",
    ):
        await set_setting("mod_log_channel_id", str(channel.id))
        await set_setting("moderation_sensitivity", sensitivity)
        await set_setting("moderation_enabled", "true")
        await interaction.response.send_message(
            f"✅ Moderation enabled. Alerts will post to {channel.mention} with **{sensitivity}** sensitivity.",
            ephemeral=True,
        )

    @mod_group.command(name="disable", description="[Admin] Disable moderation")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def mod_disable(self, interaction: discord.Interaction):
        await set_setting("moderation_enabled", "false")
        await interaction.response.send_message("✅ Moderation disabled.", ephemeral=True)

    @mod_group.command(name="status", description="Check moderation configuration")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def mod_status(self, interaction: discord.Interaction):
        enabled = await get_setting("moderation_enabled", "false")
        channel_id = await get_setting("mod_log_channel_id", "")
        sensitivity = await get_setting("moderation_sensitivity", "medium")
        channel = self.bot.get_channel(int(channel_id)) if channel_id else None
        await interaction.response.send_message(
            f"**Moderation:** {'✅ Enabled' if enabled == 'true' else '❌ Disabled'}\n"
            f"**Log Channel:** {channel.mention if channel else 'Not set'}\n"
            f"**Sensitivity:** {sensitivity.capitalize()}",
            ephemeral=True,
        )

    @mod_group.command(name="sensitivity", description="[Admin] Change sensitivity level")
    @app_commands.choices(level=[
        app_commands.Choice(name="Low — only serious violations", value="low"),
        app_commands.Choice(name="Medium — balanced (recommended)", value="medium"),
        app_commands.Choice(name="High — flag anything borderline", value="high"),
    ])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def mod_sensitivity(self, interaction: discord.Interaction, level: str):
        await set_setting("moderation_sensitivity", level)
        await interaction.response.send_message(
            f"✅ Sensitivity set to **{level}**.", ephemeral=True
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))