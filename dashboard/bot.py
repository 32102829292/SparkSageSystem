from __future__ import annotations

import discord
from discord.ext import commands
import config
import providers
import db as database
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('sparksage')

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix=config.BOT_PREFIX, intents=intents)


def get_bot_status() -> dict:
    try:
        if bot.is_ready():
            return {
                "online": True,
                "username": str(bot.user),
                "latency_ms": round(bot.latency * 1000, 1),
                "guild_count": len(bot.guilds),
                "guilds": [{"id": str(g.id), "name": g.name, "member_count": g.member_count} for g in bot.guilds],
            }
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
    return {"online": False, "username": None, "latency_ms": None, "guild_count": 0, "guilds": []}


@bot.event
async def on_ready():
    logger.info("Bot is starting up...")

    try:
        await database.init_db()
        await database.sync_env_to_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    cogs = [
        "cogs.general",
        "cogs.faq",
        "cogs.review",
        "cogs.onboarding",
        "cogs.permissions",
        "cogs.translate",
        "cogs.analytics",
        "cogs.custom_commands",
        "cogs.digest",
        "cogs.moderation",
        "cogs.channel_prompts",
        "cogs.channel_providers",
        "cogs.rate_limits",
    ]

    for cog in cogs:
        try:
            await bot.load_extension(cog)
            logger.info(f"Loaded cog: {cog}")
        except Exception as e:
            logger.warning(f"Failed to load cog {cog}: {e}")

    available = providers.get_available_providers()
    primary = config.AI_PROVIDER
    provider_info = config.PROVIDERS.get(primary, {})

    logger.info(f"SparkSage is online as {bot.user}")
    logger.info(f"Connected to {len(bot.guilds)} guild(s)")
    logger.info(f"Primary provider: {provider_info.get('name', primary)} ({provider_info.get('model', '?')})")
    logger.info(f"Fallback chain: {' -> '.join(available)}")

    try:
        synced = await bot.tree.sync()
        logger.info(f"Synced {len(synced)} slash command(s)")
    except Exception as e:
        logger.error(f"Failed to sync commands: {e}")

    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name=f"{config.BOT_PREFIX}help | {len(bot.guilds)} servers"
        )
    )


@bot.event
async def on_message(message: discord.Message):
    if message.author == bot.user:
        return

    # Custom command trigger using ! prefix
    if message.content.startswith("!") and len(message.content) > 1:
        cmd_name = message.content[1:].strip().lower().split()[0]
        guild_id = str(message.guild.id) if message.guild else "global"
        cmd = await database.get_custom_command(cmd_name, guild_id)
        if not cmd:
            cmd = await database.get_custom_command(cmd_name, "global")
        if cmd:
            await message.reply(cmd["response"])
            await database.increment_custom_command_usage(cmd["id"])
            return

    # Respond when mentioned
    if bot.user in message.mentions:
        from cogs.general import ask_ai
        clean_content = message.content.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "").strip()
        if not clean_content:
            clean_content = "Hello! How can I help you today?"

        async with message.channel.typing():
            response, provider_name = await ask_ai(
                message.channel.id, message.author.display_name, clean_content
            )

        for i in range(0, len(response), 2000):
            await message.reply(response[i:i + 2000])

    await bot.process_commands(message)


@bot.event
async def on_guild_join(guild: discord.Guild):
    logger.info(f"Joined new guild: {guild.name} (ID: {guild.id})")
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name=f"{config.BOT_PREFIX}help | {len(bot.guilds)} servers"
        )
    )


@bot.event
async def on_guild_remove(guild: discord.Guild):
    logger.info(f"Left guild: {guild.name} (ID: {guild.id})")
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name=f"{config.BOT_PREFIX}help | {len(bot.guilds)} servers"
        )
    )


@bot.event
async def on_command_error(ctx: commands.Context, error: commands.CommandError):
    if isinstance(error, commands.CommandNotFound):
        return
    elif isinstance(error, commands.MissingPermissions):
        await ctx.send("You don't have permission to use this command.")
    elif isinstance(error, commands.BotMissingPermissions):
        await ctx.send("I don't have the required permissions to do that.")
    else:
        logger.error(f"Command error: {error}")
        await ctx.send(f"An error occurred: {error}")


def main():
    if not config.DISCORD_TOKEN:
        logger.error("Error: DISCORD_TOKEN not set. Copy .env.example to .env and fill in your tokens.")
        return

    token_preview = config.DISCORD_TOKEN[:10] + "..." if len(config.DISCORD_TOKEN) > 10 else "invalid"
    logger.info(f"Discord token loaded (starts with: {token_preview})")
    logger.info(f"Token length: {len(config.DISCORD_TOKEN)} characters")

    available = providers.get_available_providers()
    if not available:
        logger.error("Error: No AI providers configured. Add at least one API key to .env")
        logger.error("Free options: GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY")
        return

    logger.info(f"Available AI providers: {', '.join(available)}")

    try:
        bot.run(config.DISCORD_TOKEN, log_handler=None)
    except discord.LoginFailure:
        logger.error("Failed to login: Invalid Discord token")
        logger.error("Please check your DISCORD_TOKEN in the .env file")
    except discord.PrivilegedIntentsRequired:
        logger.error("Failed to login: Privileged intents not enabled")
        logger.error("Please enable Message Content Intent in the Discord Developer Portal")
    except Exception as e:
        logger.error(f"Failed to start bot: {e}")


# EXPORT BOT INSTANCE FOR PLUGINS AND API
_bot_instance = bot

def get_bot():
    """Get the bot instance from anywhere"""
    return _bot_instance


if __name__ == "__main__":
    main()