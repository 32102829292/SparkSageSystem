"""cogs/onboarding.py — New member welcome"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os
import providers
import config

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


async def get_setting(guild_id, key):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT value FROM config WHERE key=?", (f"onboarding_{key}_{guild_id}",)
        ) as cur:
            row = await cur.fetchone()
            return row["value"] if row else None


async def set_setting(guild_id, key, value):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?,?)",
            (f"onboarding_{key}_{guild_id}", value)
        )
        await db.commit()


class Onboarding(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        guild_id = str(member.guild.id)
        enabled = await get_setting(guild_id, "enabled")
        if enabled != "true":
            return

        channel_id = await get_setting(guild_id, "channel_id")
        template = await get_setting(guild_id, "template")
        server_name = member.guild.name

        if template:
            message = template.replace("{user}", member.display_name)
            message = message.replace("{server}", server_name)
            message = message.replace("{mention}", member.mention)
        else:
            system = "Write a short, friendly 2-sentence welcome message for a new Discord member. Use emojis. Do not use @mentions."
            user_prompt = f"Welcome {member.display_name} to '{server_name}'."
            try:
                message, _ = providers.chat([{"role": "user", "content": user_prompt}], system)
            except Exception:
                message = f"Welcome to {server_name}, {member.display_name}! 🎉"

        embed = discord.Embed(
            title=f"👋 Welcome, {member.display_name}!",
            description=message,
            color=discord.Color.green()
        )
        embed.set_thumbnail(url=member.display_avatar.url)

        if channel_id:
            channel = member.guild.get_channel(int(channel_id))
            if channel:
                await channel.send(embed=embed)
                return

        try:
            await member.send(embed=embed)
        except discord.Forbidden:
            pass

    onboarding_group = app_commands.Group(name="onboarding", description="Configure member onboarding")

    @onboarding_group.command(name="setup", description="[Admin] Configure onboarding")
    @app_commands.describe(
        channel="Channel for welcome messages (leave blank for DM)",
        template="Custom message ({user}, {server}, {mention})",
    )
    @app_commands.checks.has_permissions(manage_guild=True)
    async def onboarding_setup(self, interaction: discord.Interaction, channel: discord.TextChannel = None, template: str = None):
        guild_id = str(interaction.guild_id)
        await set_setting(guild_id, "enabled", "true")
        if channel:
            await set_setting(guild_id, "channel_id", str(channel.id))
        if template:
            await set_setting(guild_id, "template", template)

        embed = discord.Embed(title="✅ Onboarding Configured", color=discord.Color.green())
        embed.add_field(name="Channel", value=channel.mention if channel else "DM")
        embed.add_field(name="Mode", value="Custom template" if template else "AI-generated")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @onboarding_group.command(name="disable", description="[Admin] Disable onboarding")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def onboarding_disable(self, interaction: discord.Interaction):
        await set_setting(str(interaction.guild_id), "enabled", "false")
        await interaction.response.send_message("✅ Onboarding disabled.", ephemeral=True)

    @onboarding_group.command(name="preview", description="[Admin] Preview welcome message")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def onboarding_preview(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True, thinking=True)
        guild_id = str(interaction.guild_id)
        template = await get_setting(guild_id, "template")
        member = interaction.user
        server_name = interaction.guild.name

        if template:
            message = template.replace("{user}", member.display_name).replace("{server}", server_name).replace("{mention}", member.mention)
        else:
            system = "Write a short friendly 2-sentence welcome message for a new Discord member. Use emojis."
            try:
                message, _ = providers.chat([{"role": "user", "content": f"Welcome {member.display_name} to '{server_name}'."}], system)
            except Exception:
                message = f"Welcome to {server_name}, {member.display_name}! 🎉"

        embed = discord.Embed(title=f"👋 Preview: Welcome, {member.display_name}!", description=message, color=discord.Color.blurple())
        embed.set_footer(text="This is a preview only")
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot):
    await bot.add_cog(Onboarding(bot))