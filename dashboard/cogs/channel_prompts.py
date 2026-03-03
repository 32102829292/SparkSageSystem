"""cogs/channel_prompts.py — Per-channel custom system prompts"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


async def ensure_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS channel_prompts (
                channel_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                system_prompt TEXT NOT NULL
            )
        """)
        await db.commit()


async def get_channel_prompt(channel_id: str) -> str | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute_fetchone(
            "SELECT system_prompt FROM channel_prompts WHERE channel_id=?", (channel_id,)
        )
        return row["system_prompt"] if row else None


class ChannelPrompts(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        await ensure_table()

    prompt_group = app_commands.Group(name="prompt", description="Per-channel AI prompt settings")

    @prompt_group.command(name="set", description="[Admin] Set a custom AI prompt for this channel")
    @app_commands.describe(text="The system prompt for this channel")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def prompt_set(self, interaction: discord.Interaction, text: str):
        await ensure_table()
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT OR REPLACE INTO channel_prompts (channel_id, guild_id, system_prompt) VALUES (?,?,?)",
                (str(interaction.channel_id), str(interaction.guild_id), text)
            )
            await db.commit()
        embed = discord.Embed(
            title="✅ Channel Prompt Set",
            description=f"This channel will now use a custom AI personality:\n\n> {text[:300]}",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @prompt_group.command(name="reset", description="[Admin] Reset this channel to the default AI prompt")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def prompt_reset(self, interaction: discord.Interaction):
        await ensure_table()
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "DELETE FROM channel_prompts WHERE channel_id=?", (str(interaction.channel_id),)
            )
            await db.commit()
        await interaction.response.send_message("✅ Channel prompt reset to default.", ephemeral=True)

    @prompt_group.command(name="view", description="View the current prompt for this channel")
    async def prompt_view(self, interaction: discord.Interaction):
        await ensure_table()
        prompt = await get_channel_prompt(str(interaction.channel_id))
        if prompt:
            embed = discord.Embed(title="🤖 Channel Prompt", description=prompt, color=discord.Color.blurple())
        else:
            embed = discord.Embed(title="🤖 Channel Prompt", description="Using default server prompt.", color=discord.Color.greyple())
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot):
    await bot.add_cog(ChannelPrompts(bot))