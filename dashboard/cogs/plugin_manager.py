"""cogs/plugin_manager.py — /plugin commands"""
import discord
from discord import app_commands
from discord.ext import commands
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from plugins.loader import list_plugins, load_plugin, unload_plugin


class PluginManager(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    plugin_group = app_commands.Group(name="plugin", description="Manage SparkSage plugins")

    @plugin_group.command(name="list", description="List available plugins")
    async def plugin_list(self, interaction: discord.Interaction):
        plugins = list_plugins()
        if not plugins:
            await interaction.response.send_message("📦 No plugins available.", ephemeral=True)
            return
        embed = discord.Embed(title="🔌 Plugins", color=discord.Color.blurple())
        for p in plugins:
            status = "✅ Enabled" if p.get("enabled") else "⭕ Disabled"
            embed.add_field(
                name=f"{p.get('name', 'Unknown')} v{p.get('version', '?')}",
                value=f"{p.get('description', '')}\n{status}",
                inline=False
            )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @plugin_group.command(name="enable", description="[Admin] Enable a plugin")
    @app_commands.describe(name="Plugin name")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def plugin_enable(self, interaction: discord.Interaction, name: str):
        success = await load_plugin(self.bot, name)
        if success:
            await interaction.response.send_message(f"✅ Plugin `{name}` enabled.", ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ Failed to enable `{name}`. Check the plugin exists.", ephemeral=True)

    @plugin_group.command(name="disable", description="[Admin] Disable a plugin")
    @app_commands.describe(name="Plugin name")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def plugin_disable(self, interaction: discord.Interaction, name: str):
        success = await unload_plugin(self.bot, name)
        if success:
            await interaction.response.send_message(f"✅ Plugin `{name}` disabled.", ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ Plugin `{name}` is not loaded.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(PluginManager(bot))