"""cogs/rate_limits.py — Rate limit decorator and monitoring for Discord commands"""
from discord.ext import commands
from utils.rate_limiter import check_rate_limit, get_user_usage, get_guild_usage
import config
import logging
import discord
from discord import app_commands

logger = logging.getLogger('sparksage')


def rate_limit(user_limit: int = None, guild_limit: int = None):
    """
    Rate limit decorator for prefix commands
    Usage: @rate_limit() or @rate_limit(user_limit=10, guild_limit=50)
    """
    def decorator(func):
        async def wrapper(self, ctx, *args, **kwargs):
            # Get IDs
            guild_id = str(ctx.guild.id) if ctx.guild else "dm"
            user_id = str(ctx.author.id)
            
            # Get limits from config if not specified
            actual_user_limit = user_limit or getattr(config, 'RATE_LIMIT_USER', 20)
            actual_guild_limit = guild_limit or getattr(config, 'RATE_LIMIT_GUILD', 200)
            
            # Check rate limit
            allowed, message = check_rate_limit(
                guild_id, 
                user_id,
                user_limit=actual_user_limit,
                guild_limit=actual_guild_limit
            )
            
            if not allowed:
                logger.warning(f"Rate limited: {ctx.author.name} in {ctx.guild.name if ctx.guild else 'DM'}")
                await ctx.send(message, delete_after=5)
                return
            
            return await func(self, ctx, *args, **kwargs)
        return wrapper
    return decorator


def slash_rate_limit(user_limit: int = None, guild_limit: int = None):
    """Rate limit decorator for slash commands"""
    def decorator(func):
        async def wrapper(self, interaction, *args, **kwargs):
            # Defer if needed
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=True)
            
            # Get IDs
            guild_id = str(interaction.guild_id) if interaction.guild_id else "dm"
            user_id = str(interaction.user.id)
            
            # Get limits from config if not specified
            actual_user_limit = user_limit or getattr(config, 'RATE_LIMIT_USER', 20)
            actual_guild_limit = guild_limit or getattr(config, 'RATE_LIMIT_GUILD', 200)
            
            # Check rate limit
            allowed, message = check_rate_limit(
                guild_id, 
                user_id,
                user_limit=actual_user_limit,
                guild_limit=actual_guild_limit
            )
            
            if not allowed:
                logger.warning(f"Rate limited: {interaction.user.name} in {interaction.guild.name if interaction.guild else 'DM'}")
                await interaction.followup.send(message, ephemeral=True)
                return
            
            return await func(self, interaction, *args, **kwargs)
        return wrapper
    return decorator


# ===== Rate Limit Monitoring Commands =====

class RateMonitor(commands.Cog):
    """Cog for rate limit monitoring commands"""
    
    def __init__(self, bot):
        self.bot = bot

    @commands.hybrid_command(name="ratestatus", description="Check your current rate limit usage")
    async def ratestatus(self, ctx: commands.Context):
        """Check your personal rate limit status"""
        guild_id = str(ctx.guild.id) if ctx.guild else "dm"
        user_id = str(ctx.author.id)
        
        usage = get_user_usage(guild_id, user_id)
        
        # Determine color based on usage
        percentage = (usage['used'] / usage['limit']) * 100
        if percentage >= 90:
            color = discord.Color.red()
            status = "🔴 Critical"
        elif percentage >= 70:
            color = discord.Color.orange()
            status = "🟡 Warning"
        else:
            color = discord.Color.green()
            status = "🟢 Healthy"
        
        embed = discord.Embed(
            title="⏱️ Your Rate Limit Status",
            color=color
        )
        embed.add_field(name="Status", value=status, inline=False)
        embed.add_field(name="Used", value=f"{usage['used']} requests", inline=True)
        embed.add_field(name="Remaining", value=f"{usage['remaining']}", inline=True)
        embed.add_field(name="Limit", value=f"{usage['limit']}/minute", inline=True)
        embed.add_field(name="Resets in", value=f"{usage['reset_in']} seconds", inline=True)
        
        await ctx.send(embed=embed)

    @commands.hybrid_command(name="guildlimits", description="Check server rate limit usage")
    @commands.has_permissions(manage_guild=True)
    async def guildlimits(self, ctx: commands.Context):
        """Check server-wide rate limit status"""
        if not ctx.guild:
            await ctx.send("This command only works in servers.")
            return
            
        guild_id = str(ctx.guild.id)
        usage = get_guild_usage(guild_id)
        
        percentage = (usage['used'] / usage['limit']) * 100
        if percentage >= 90:
            color = discord.Color.red()
            status = "🔴 Critical"
        elif percentage >= 70:
            color = discord.Color.orange()
            status = "🟡 Warning"
        else:
            color = discord.Color.green()
            status = "🟢 Healthy"
        
        embed = discord.Embed(
            title=f"⏱️ Server Rate Limit - {ctx.guild.name}",
            color=color
        )
        embed.add_field(name="Status", value=status, inline=False)
        embed.add_field(name="Used", value=f"{usage['used']} requests", inline=True)
        embed.add_field(name="Remaining", value=f"{usage['remaining']}", inline=True)
        embed.add_field(name="Limit", value=f"{usage['limit']}/minute", inline=True)
        embed.add_field(name="Resets in", value=f"{usage['reset_in']} seconds", inline=True)
        
        await ctx.send(embed=embed)

    # REMOVED: The duplicate slash command at lines 128-167


# ===== Setup Function =====

async def setup(bot):
    """Setup function for the cog"""
    await bot.add_cog(RateMonitor(bot))
    logger.info("Rate limits cog loaded successfully")