from __future__ import annotations
import discord
from discord.ext import commands
from discord import app_commands
import db as database
import logging

logger = logging.getLogger("sparksage")


class CustomCommands(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction):
        if interaction.type != discord.InteractionType.application_command:
            return
        name = interaction.data.get("name", "")
        guild_id = str(interaction.guild_id) if interaction.guild_id else "global"
        cmd = await database.get_custom_command(name, guild_id)
        if not cmd:
            cmd = await database.get_custom_command(name, "global")
        if cmd:
            await interaction.response.send_message(cmd["response"])
            await database.increment_custom_command_usage(cmd["id"])

    @app_commands.command(name="cmd", description="Manage custom commands")
    @app_commands.describe(
        action="Action: add, remove, list",
        name="Command name (without /)",
        response="The response text",
        description="Short description of the command",
    )
    async def cmd(
        self,
        interaction: discord.Interaction,
        action: str,
        name: str | None = None,
        response: str | None = None,
        description: str | None = None,
    ):
        guild_id = str(interaction.guild_id) if interaction.guild_id else "global"

        if action == "list":
            commands_list = await database.get_custom_commands(guild_id)
            if not commands_list:
                await interaction.response.send_message("No custom commands yet. Use `/cmd add` to create one.")
                return
            lines = [f"`/{c['name']}` — {c['description']} (used {c['times_used']}x)" for c in commands_list]
            await interaction.response.send_message("**Custom Commands:**\n" + "\n".join(lines))

        elif action == "add":
            if not name or not response:
                await interaction.response.send_message("Usage: `/cmd add name:<name> response:<text>`")
                return
            try:
                await database.create_custom_command(
                    name=name,
                    response=response,
                    description=description or "A custom command",
                    guild_id=guild_id,
                    created_by=str(interaction.user.id),
                )
                await interaction.response.send_message(f"✅ Custom command `/{name}` created!")
            except Exception as e:
                await interaction.response.send_message(f"❌ Failed to create command. It may already exist.")

        elif action == "remove":
            if not name:
                await interaction.response.send_message("Usage: `/cmd remove name:<name>`")
                return
            cmds = await database.get_custom_commands(guild_id)
            match = next((c for c in cmds if c["name"] == name.lower()), None)
            if not match:
                await interaction.response.send_message(f"❌ Command `/{name}` not found.")
                return
            await database.delete_custom_command(match["id"])
            await interaction.response.send_message(f"✅ Command `/{name}` removed.")

        else:
            await interaction.response.send_message("Valid actions: `add`, `remove`, `list`")


async def setup(bot: commands.Bot):
    await bot.add_cog(CustomCommands(bot))