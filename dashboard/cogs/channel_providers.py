"""cogs/channel_providers.py — Per-channel AI provider override"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")
PROVIDERS = ["gemini", "groq", "openrouter", "anthropic", "openai"]


async def ensure_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS channel_providers (
                channel_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                provider TEXT NOT NULL
            )
        """)
        await db.commit()


async def get_channel_provider(channel_id: str) -> str | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT provider FROM channel_providers WHERE channel_id=?",
            (channel_id,)
        )
        row = await cursor.fetchone()
        return row["provider"] if row else None


class ChannelProviders(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.cache = {}

    @commands.Cog.listener()
    async def on_ready(self):
        await ensure_table()
        print("✅ Channel Providers cog loaded")

    cp_group = app_commands.Group(name="channel-provider", description="Per-channel AI provider settings")

    @cp_group.command(name="set", description="[Admin] Set AI provider for this channel")
    @app_commands.describe(provider="The AI provider to use in this channel")
    @app_commands.choices(provider=[
        app_commands.Choice(name="Gemini (Google)", value="gemini"),
        app_commands.Choice(name="Groq (Llama)", value="groq"),
        app_commands.Choice(name="OpenRouter", value="openrouter"),
        app_commands.Choice(name="Anthropic (Claude)", value="anthropic"),
        app_commands.Choice(name="OpenAI (GPT)", value="openai"),
    ])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def cp_set(self, interaction: discord.Interaction, provider: str):
        await ensure_table()
        channel_id = str(interaction.channel_id)
        guild_id = str(interaction.guild_id)
        
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT OR REPLACE INTO channel_providers (channel_id, guild_id, provider) VALUES (?,?,?)",
                (channel_id, guild_id, provider)
            )
            await db.commit()
        
        self.cache[channel_id] = provider
        await interaction.response.send_message(
            f"✅ This channel will now use **{provider}** as its AI provider.",
            ephemeral=True
        )

    @cp_group.command(name="reset", description="[Admin] Reset channel to default provider")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def cp_reset(self, interaction: discord.Interaction):
        await ensure_table()
        channel_id = str(interaction.channel_id)
        
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("DELETE FROM channel_providers WHERE channel_id=?", (channel_id,))
            await db.commit()
        
        if channel_id in self.cache:
            del self.cache[channel_id]
        
        await interaction.response.send_message(
            "✅ Channel provider reset to server default.",
            ephemeral=True
        )

    @cp_group.command(name="view", description="View the provider for this channel")
    async def cp_view(self, interaction: discord.Interaction):
        await ensure_table()
        channel_id = str(interaction.channel_id)
        
        if channel_id in self.cache:
            provider = self.cache[channel_id]
            await interaction.response.send_message(
                f"🤖 This channel uses **{provider}** (override).",
                ephemeral=True
            )
            return
        
        provider = await get_channel_provider(channel_id)
        if provider:
            self.cache[channel_id] = provider
            await interaction.response.send_message(
                f"🤖 This channel uses **{provider}** (override).",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "🤖 This channel uses the server default provider.",
                ephemeral=True
            )


async def setup(bot):
    await bot.add_cog(ChannelProviders(bot))