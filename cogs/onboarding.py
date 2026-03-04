"""cogs/permissions.py — Role-based command permissions"""
import discord
from discord import app_commands
from discord.ext import commands
import db as database

COMMANDS = ["ask", "review", "faq", "summarize", "translate"]


class Permissions(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    perms_group = app_commands.Group(name="permissions", description="Manage command permissions")

    @perms_group.command(name="set", description="[Admin] Set who can use a command")
    @app_commands.describe(command="Command name", mode="Access mode", role="Restrict to role")
    @app_commands.choices(command=[app_commands.Choice(name=c, value=c) for c in COMMANDS])
    @app_commands.choices(mode=[
        app_commands.Choice(name="Everyone", value="everyone"),
        app_commands.Choice(name="Admins only", value="admin_only"),
    ])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_set(self, interaction: discord.Interaction, command: str, mode: str = "everyone", role: discord.Role = None):
        guild_id = str(interaction.guild_id)
        role_id = str(role.id) if role else None
        await database.add_permission(command, guild_id, role_id or mode)
        label = role.mention if role else ("admins only" if mode == "admin_only" else "everyone")
        await interaction.response.send_message(f"✅ `/{command}` is now restricted to {label}.", ephemeral=True)

    @perms_group.command(name="list", description="[Admin] Show permission settings")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_list(self, interaction: discord.Interaction):
        perms = await database.get_permissions()
        guild_id = str(interaction.guild_id)
        guild_perms = {p["command_name"]: p for p in perms if p["guild_id"] == guild_id}

        embed = discord.Embed(title="🔒 Command Permissions", color=discord.Color.blurple())
        for cmd in COMMANDS:
            if cmd in guild_perms:
                role_id = guild_perms[cmd].get("role_id")
                if role_id and role_id.isdigit():
                    role = interaction.guild.get_role(int(role_id))
                    val = f"👥 {role.mention if role else role_id}"
                elif role_id == "admin_only":
                    val = "🔐 Admins only"
                else:
                    val = "✅ Everyone"
            else:
                val = "✅ Everyone"
            embed.add_field(name=f"/{cmd}", value=val, inline=True)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @perms_group.command(name="reset", description="[Admin] Reset command to everyone")
    @app_commands.describe(command="Command to reset")
    @app_commands.choices(command=[app_commands.Choice(name=c, value=c) for c in COMMANDS])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_reset(self, interaction: discord.Interaction, command: str):
        await database.remove_permission(command, str(interaction.guild_id), "")
        await interaction.response.send_message(f"✅ `/{command}` reset to everyone.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(Permissions(bot))