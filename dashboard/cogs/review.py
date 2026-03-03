"""cogs/review.py — /review command"""
import discord
from discord import app_commands
from discord.ext import commands
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import providers
import config


class Review(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="review", description="Get an AI code or text review")
    @app_commands.describe(
        code="The code or text to review",
        language="Programming language (e.g. python, javascript)",
        focus="What to focus on"
    )
    @app_commands.choices(focus=[
        app_commands.Choice(name="General", value="general"),
        app_commands.Choice(name="Security", value="security"),
        app_commands.Choice(name="Performance", value="performance"),
        app_commands.Choice(name="Style", value="style"),
    ])
    async def review(self, interaction: discord.Interaction, code: str, language: str = "", focus: str = "general"):
        await interaction.response.defer(thinking=True)

        focus_map = {
            "general": "Provide a thorough general review covering correctness, clarity, and best practices.",
            "security": "Focus on security vulnerabilities, injection risks, and unsafe patterns.",
            "performance": "Focus on performance bottlenecks and optimization opportunities.",
            "style": "Focus on readability, naming conventions, and maintainability.",
        }

        system = (
            f"You are an expert code reviewer. {focus_map.get(focus, focus_map['general'])} "
            "Use Discord markdown. Use ✅ for good things, ⚠️ for warnings, ❌ for problems. Be concise."
        )
        lang = language or "code"
        user_msg = f"Review this {lang}:\n```{language}\n{code}\n```"

        try:
            response, provider_name = providers.chat(
                [{"role": "user", "content": user_msg}], system
            )
        except Exception as e:
            await interaction.followup.send(f"❌ AI error: {e}")
            return

        if len(response) > 1900:
            chunks = [response[i:i+1900] for i in range(0, len(response), 1900)]
            await interaction.followup.send(f"**📋 Code Review** (focus: `{focus}`)\n\n{chunks[0]}")
            for chunk in chunks[1:]:
                await interaction.followup.send(chunk)
        else:
            await interaction.followup.send(f"**📋 Code Review** (focus: `{focus}`)\n\n{response}")


async def setup(bot):
    await bot.add_cog(Review(bot))