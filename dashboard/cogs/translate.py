"""cogs/translate.py — /translate command"""
import discord
from discord import app_commands
from discord.ext import commands
import providers
import config


class Translate(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="translate", description="Translate text to another language")
    @app_commands.describe(text="Text to translate", target_language="Target language")
    @app_commands.choices(target_language=[
        app_commands.Choice(name="Spanish", value="Spanish"),
        app_commands.Choice(name="French", value="French"),
        app_commands.Choice(name="German", value="German"),
        app_commands.Choice(name="Japanese", value="Japanese"),
        app_commands.Choice(name="Chinese", value="Chinese (Simplified)"),
        app_commands.Choice(name="Arabic", value="Arabic"),
        app_commands.Choice(name="Portuguese", value="Portuguese"),
        app_commands.Choice(name="Korean", value="Korean"),
        app_commands.Choice(name="Italian", value="Italian"),
        app_commands.Choice(name="Russian", value="Russian"),
    ])
    async def translate(self, interaction: discord.Interaction, text: str, target_language: str):
        await interaction.response.defer(thinking=True)
        system = f"Translate the text to {target_language}. Return ONLY the translated text, nothing else."
        try:
            translated, provider_name = providers.chat([{"role": "user", "content": text}], system)
        except Exception as e:
            await interaction.followup.send(f"❌ Translation failed: {e}")
            return
        embed = discord.Embed(color=discord.Color.blue())
        embed.add_field(name="🌐 Original", value=text[:1024], inline=False)
        embed.add_field(name=f"✅ {target_language}", value=translated[:1024], inline=False)
        await interaction.followup.send(embed=embed)


async def setup(bot):
    await bot.add_cog(Translate(bot))