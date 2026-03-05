"""plugins/available/welcome.py — Welcome plugin with rich embeds"""
import discord
from discord import app_commands
from discord.ext import commands
import db


class Welcome(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        """Send a welcome embed when a member joins."""
        guild = member.guild

        # Get config
        enabled = await db.get_config(f"welcome_enabled_{guild.id}", "false")
        if enabled != "true":
            return

        channel_id = await db.get_config(f"welcome_channel_id_{guild.id}", "")
        if not channel_id:
            return

        channel = guild.get_channel(int(channel_id))
        if not channel:
            return

        # Get custom message or use default
        message = await db.get_config(f"welcome_message_{guild.id}", "")
        if message:
            message = message.replace("{user}", member.display_name)
            message = message.replace("{mention}", member.mention)
            message = message.replace("{server}", guild.name)
            message = message.replace("{count}", str(guild.member_count))
        else:
            message = f"We're so glad you're here! Make sure to check out the server rules and introduction channels."

        embed = discord.Embed(
            title=f"Welcome to {guild.name}! 🎉",
            description=f"{member.mention} just joined the server!\n\n{message}",
            color=discord.Color.blurple()
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        embed.set_footer(text=f"Member #{guild.member_count}")

        await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        """Send a goodbye message when a member leaves."""
        guild = member.guild

        farewell = await db.get_config(f"welcome_farewell_{guild.id}", "false")
        if farewell != "true":
            return

        channel_id = await db.get_config(f"welcome_channel_id_{guild.id}", "")
        if not channel_id:
            return

        channel = guild.get_channel(int(channel_id))
        if not channel:
            return

        embed = discord.Embed(
            description=f"**{member.display_name}** has left the server. Goodbye! 👋",
            color=discord.Color.red()
        )
        await channel.send(embed=embed)

    # ── Slash commands ──────────────────────────────────────────────────────

    @app_commands.command(name="welcome-setup", description="Configure the welcome plugin")
    @app_commands.describe(
        channel="Channel to send welcome messages in",
        farewell="Also send goodbye messages when members leave",
        message="Custom welcome message (use {user}, {mention}, {server}, {count})"
    )
    @app_commands.default_permissions(manage_guild=True)
    async def welcome_setup(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        farewell: bool = False,
        message: str = ""
    ):
        guild_id = interaction.guild_id
        await db.set_config(f"welcome_enabled_{guild_id}", "true")
        await db.set_config(f"welcome_channel_id_{guild_id}", str(channel.id))
        await db.set_config(f"welcome_farewell_{guild_id}", "true" if farewell else "false")
        if message:
            await db.set_config(f"welcome_message_{guild_id}", message)

        embed = discord.Embed(
            title="✅ Welcome Plugin Configured",
            color=discord.Color.green()
        )
        embed.add_field(name="Channel", value=channel.mention, inline=True)
        embed.add_field(name="Farewell messages", value="Enabled" if farewell else "Disabled", inline=True)
        embed.add_field(
            name="Message",
            value=message or "Default message",
            inline=False
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="welcome-disable", description="Disable the welcome plugin")
    @app_commands.default_permissions(manage_guild=True)
    async def welcome_disable(self, interaction: discord.Interaction):
        await db.set_config(f"welcome_enabled_{interaction.guild_id}", "false")
        await interaction.response.send_message("✅ Welcome messages disabled.", ephemeral=True)

    @app_commands.command(name="welcome-test", description="Send a test welcome message")
    @app_commands.default_permissions(manage_guild=True)
    async def welcome_test(self, interaction: discord.Interaction):
        await self.on_member_join(interaction.user if hasattr(interaction.user, 'guild') else interaction.guild.me)
        await interaction.response.send_message("✅ Test welcome message sent!", ephemeral=True)


async def setup(bot):
    await bot.add_cog(Welcome(bot))