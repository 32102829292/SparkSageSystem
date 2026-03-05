"""cogs/permissions.py — Role-based command permissions"""
import traceback
traceback.print_stack()
import discord
from discord import app_commands
from discord.ext import commands
import db as database
import logging

logger = logging.getLogger('sparksage')

COMMANDS = ["ask", "review", "faq", "summarize", "translate"]


async def check_command_permission(interaction: discord.Interaction, command_name: str) -> bool:
    """Returns True if user is allowed to run the command, False if blocked."""
    guild_id = str(interaction.guild_id)
    try:
        pool = await database.get_db()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT role_id FROM permissions WHERE command_name = $1 AND guild_id = $2",
                command_name, guild_id
            )
        if not row or not row["role_id"]:
            return True
        user_role_ids = [str(r.id) for r in interaction.user.roles]
        return row["role_id"] in user_role_ids
    except Exception as e:
        logger.error(f"Permission check error: {e}")
        return True  # Fail open so commands still work if DB is down


class Permissions(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    perms_group = app_commands.Group(name="permissions", description="Manage command permissions")

    @perms_group.command(name="set", description="[Admin] Set who can use a command")
    @app_commands.describe(command="Command name", role="Restrict to role")
    @app_commands.choices(command=[app_commands.Choice(name=c, value=c) for c in COMMANDS])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_set(self, interaction: discord.Interaction, command: str, role: discord.Role = None):
        guild_id = str(interaction.guild_id)
        role_id = str(role.id) if role else None
        try:
            await database.add_permission(command, guild_id, role_id)
            label = role.mention if role else "everyone"
            await interaction.response.send_message(f"✅ `/{command}` is now restricted to {label}.", ephemeral=True)
        except Exception as e:
            logger.error(f"Error setting permission: {e}")
            await interaction.response.send_message("❌ Failed to set permission.", ephemeral=True)

    @perms_group.command(name="list", description="[Admin] Show permission settings")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_list(self, interaction: discord.Interaction):
        guild_id = str(interaction.guild_id)
        try:
            pool = await database.get_db()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT command_name, role_id FROM permissions WHERE guild_id = $1", guild_id
                )
            embed = discord.Embed(title="🔒 Command Permissions", color=discord.Color.blurple())
            settings = {row["command_name"]: row for row in rows}
            for cmd in COMMANDS:
                if cmd in settings and settings[cmd]["role_id"]:
                    role = interaction.guild.get_role(int(settings[cmd]["role_id"]))
                    val = f"👥 {role.mention if role else settings[cmd]['role_id']}"
                else:
                    val = "✅ Everyone"
                embed.add_field(name=f"/{cmd}", value=val, inline=True)
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"Error listing permissions: {e}")
            await interaction.response.send_message("❌ Failed to load permissions.", ephemeral=True)

    @perms_group.command(name="reset", description="[Admin] Reset command to everyone")
    @app_commands.describe(command="Command to reset")
    @app_commands.choices(command=[app_commands.Choice(name=c, value=c) for c in COMMANDS])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_reset(self, interaction: discord.Interaction, command: str):
        guild_id = str(interaction.guild_id)
        try:
            await database.remove_permission(command, guild_id, None)
            await interaction.response.send_message(f"✅ `/{command}` reset to everyone.", ephemeral=True)
        except Exception as e:
            logger.error(f"Error resetting permission: {e}")
            await interaction.response.send_message("❌ Failed to reset permission.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(Permissions(bot))