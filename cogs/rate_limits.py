from discord.ext import commands
import discord
import logging
import config
from utils.rate_limiter import check_user_limit, check_guild_limit, record_usage

logger = logging.getLogger("sparksage")


class RateLimits(commands.Cog):
    """Rate limiting cog for SparkSage bot."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        """Check rate limits before processing messages."""
        if message.author.bot:
            return
        if not message.guild:
            return

        guild_id = str(message.guild.id)
        user_id = str(message.author.id)

        if not check_guild_limit(guild_id):
            logger.warning(f"Guild {guild_id} hit rate limit")
            return

        if not check_user_limit(guild_id, user_id):
            logger.warning(f"User {user_id} in guild {guild_id} hit rate limit")
            try:
                await message.reply(
                    f"⚠️ You've hit the rate limit. Please wait before sending more messages.",
                    delete_after=10
                )
            except Exception:
                pass
            return

        record_usage(guild_id, user_id)

    @commands.command(name="ratelimit", aliases=["rl"])
    @commands.has_permissions(manage_guild=True)
    async def check_rate_limit(self, ctx: commands.Context, member: discord.Member = None):
        """Check rate limit status for a user or the guild."""
        from utils.rate_limiter import get_user_usage, get_guild_usage

        guild_id = str(ctx.guild.id)

        if member:
            usage = get_user_usage(guild_id, str(member.id))
            embed = discord.Embed(
                title=f"Rate Limit: {member.display_name}",
                color=discord.Color.blue()
            )
            embed.add_field(name="Used", value=usage["used"], inline=True)
            embed.add_field(name="Remaining", value=usage["remaining"], inline=True)
            embed.add_field(name="Limit", value=usage["limit"], inline=True)
            embed.add_field(name="Resets in", value=f"{usage['reset_in']}s", inline=True)
        else:
            usage = get_guild_usage(guild_id)
            embed = discord.Embed(
                title=f"Rate Limit: {ctx.guild.name}",
                color=discord.Color.green()
            )
            embed.add_field(name="Used", value=usage["used"], inline=True)
            embed.add_field(name="Remaining", value=usage["remaining"], inline=True)
            embed.add_field(name="Limit", value=usage["limit"], inline=True)
            embed.add_field(name="Resets in", value=f"{usage['reset_in']}s", inline=True)

        await ctx.send(embed=embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(RateLimits(bot))