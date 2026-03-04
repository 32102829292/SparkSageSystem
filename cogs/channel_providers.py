"""cogs/channel_providers.py — Per-channel AI provider override"""
import discord
from discord import app_commands
from discord.ext import commands
import db as database


async def get_channel_provider(channel_id: str) -> str | None:
    return await database.get_channel_provider(channel_id)


class ChannelProviders(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.cache = {}

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
        channel_id = str(interaction.channel_id)
        guild_id = str(interaction.guild_id)
        await database.set_channel_provider(channel_id, guild_id, provider)
        self.cache[channel_id] = provider
        await interaction.response.send_message(
            f"✅ This channel will now use **{provider}** as its AI provider.",
            ephemeral=True
        )

    @cp_group.command(name="reset", description="[Admin] Reset channel to default provider")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def cp_reset(self, interaction: discord.Interaction):
        channel_id = str(interaction.channel_id)
        await database.delete_channel_provider(channel_id)
        self.cache.pop(channel_id, None)
        await interaction.response.send_message(
            "✅ Channel provider reset to server default.",
            ephemeral=True
        )

    @cp_group.command(name="view", description="View the provider for this channel")
    async def cp_view(self, interaction: discord.Interaction):
        channel_id = str(interaction.channel_id)
        provider = self.cache.get(channel_id) or await database.get_channel_provider(channel_id)
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