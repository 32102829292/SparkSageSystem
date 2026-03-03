"""cogs/permissions.py — Role-based command permissions"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")
COMMANDS = ["ask", "review", "faq", "summarize", "translate"]


async def ensure_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS command_permissions (
                command_name TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'everyone',
                role_id TEXT,
                PRIMARY KEY (command_name, guild_id)
            )
        """)
        await db.commit()


class Permissions(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        await ensure_table()

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
        await ensure_table()
        guild_id = str(interaction.guild_id)
        role_id = str(role.id) if role else None
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT OR REPLACE INTO command_permissions (command_name, guild_id, mode, role_id) VALUES (?,?,?,?)",
                (command, guild_id, "role" if role else mode, role_id)
            )
            await db.commit()
        label = role.mention if role else ("admins only" if mode == "admin_only" else "everyone")
        await interaction.response.send_message(f"✅ `/{command}` is now restricted to {label}.", ephemeral=True)

    @perms_group.command(name="list", description="[Admin] Show permission settings")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def perms_list(self, interaction: discord.Interaction):
        await ensure_table()
        guild_id = str(interaction.guild_id)
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                "SELECT command_name, mode, role_id FROM command_permissions WHERE guild_id=?", (guild_id,)
            )
        embed = discord.Embed(title="🔒 Command Permissions", color=discord.Color.blurple())
        settings = {row["command_name"]: row for row in rows}
        for cmd in COMMANDS:
            if cmd in settings:
                row = settings[cmd]
                if row["mode"] == "role" and row["role_id"]:
                    role = interaction.guild.get_role(int(row["role_id"]))
                    val = f"👥 {role.mention if role else row['role_id']}"
                elif row["mode"] == "admin_only":
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
        await ensure_table()
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "DELETE FROM command_permissions WHERE command_name=? AND guild_id=?",
                (command, str(interaction.guild_id))
            )
            await db.commit()
        await interaction.response.send_message(f"✅ `/{command}` reset to everyone.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(Permissions(bot))