from __future__ import annotations

import discord
from discord.ext import commands
from discord import app_commands
import config
import providers
import db as database
import logging

logger = logging.getLogger('sparksage')

MAX_HISTORY = 20


async def get_history(channel_id: int) -> list[dict]:
    try:
        messages = await database.get_messages(str(channel_id), limit=MAX_HISTORY)
        return [{"role": m["role"], "content": m["content"]} for m in messages]
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        return []


async def ask_ai(channel_id: int, user_name: str, message: str) -> tuple[str, str]:
    await database.add_message(str(channel_id), "user", f"{user_name}: {message}")
    history = await get_history(channel_id)
    
    try:
        # Check for channel-specific provider override
        channel_provider = await database.get_channel_provider(str(channel_id))
        
        # Check for channel-specific prompt override
        channel_prompt = await database.get_channel_prompt(str(channel_id))
        system_prompt = channel_prompt if channel_prompt else config.SYSTEM_PROMPT
        
        # Use channel provider if available, otherwise use default fallback
        if channel_provider:
            # Try to use the specific provider first
            try:
                response = providers.call_provider(
                    channel_provider, history, system_prompt
                )
                provider_name = channel_provider
            except Exception as e:
                logger.warning(f"Channel provider {channel_provider} failed: {e}")
                # Fall back to normal chain
                response, provider_name = providers.chat(history, system_prompt)
        else:
            # Use normal fallback chain
            response, provider_name = providers.chat(history, system_prompt)
        
        await database.add_message(str(channel_id), "assistant", response, provider=provider_name)
        return response, provider_name
    except RuntimeError as e:
        error_msg = f"Sorry, all AI providers failed:\n{e}"
        logger.error(error_msg)
        return error_msg, "none"


class General(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="ask", description="Ask SparkSage a question")
    @app_commands.describe(question="Your question for SparkSage")
    async def ask(self, interaction: discord.Interaction, question: str):
        await interaction.response.defer()
        try:
            response, provider_name = await ask_ai(
                interaction.channel_id, interaction.user.display_name, question
            )
            provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
            footer = f"\n-# Powered by {provider_label}"
            for i in range(0, len(response), 1900):
                chunk = response[i:i + 1900]
                if i + 1900 >= len(response):
                    chunk += footer
                await interaction.followup.send(chunk)
        except Exception as e:
            logger.error(f"Error in ask command: {e}")
            await interaction.followup.send("Sorry, an error occurred while processing your question.")

    @app_commands.command(name="clear", description="Clear SparkSage's conversation memory for this channel")
    async def clear(self, interaction: discord.Interaction):
        try:
            await database.clear_messages(str(interaction.channel_id))
            await interaction.response.send_message("✅ Conversation history cleared!")
        except Exception as e:
            logger.error(f"Error clearing history: {e}")
            await interaction.response.send_message("❌ Failed to clear conversation history.")

    @app_commands.command(name="summarize", description="Summarize the recent conversation in this channel")
    async def summarize(self, interaction: discord.Interaction):
        await interaction.response.defer()
        try:
            history = await get_history(interaction.channel_id)
            if not history:
                await interaction.followup.send("No conversation history to summarize.")
                return
            conversation_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
            summary_prompt = f"Please summarize the key points from this conversation in a concise bullet-point format:\n\n{conversation_text}"
            response, provider_name = await ask_ai(
                interaction.channel_id, "System", summary_prompt
            )
            await interaction.followup.send(f"**📊 Conversation Summary:**\n{response}")
        except Exception as e:
            logger.error(f"Error in summarize command: {e}")
            await interaction.followup.send("Sorry, an error occurred while summarizing.")

    @app_commands.command(name="provider", description="Show which AI provider SparkSage is currently using")
    async def provider(self, interaction: discord.Interaction):
        primary = config.AI_PROVIDER
        provider_info = config.PROVIDERS.get(primary, {})
        available = providers.get_available_providers()
        
        # Check if this channel has a provider override
        channel_provider = await database.get_channel_provider(str(interaction.channel_id))
        
        embed = discord.Embed(title="🤖 AI Provider Status", color=discord.Color.blue())
        
        if channel_provider:
            # Show channel override
            override_info = config.PROVIDERS.get(channel_provider, {})
            embed.add_field(
                name="📌 Channel Override",
                value=f"**{override_info.get('name', channel_provider)}** (this channel only)",
                inline=False
            )
        
        embed.add_field(
            name="Current Provider",
            value=f"**{provider_info.get('name', primary)}**\nModel: `{provider_info.get('model', '?')}`",
            inline=False
        )
        embed.add_field(
            name="Provider Type",
            value="🆓 Free" if provider_info.get('free') else "💰 Paid",
            inline=True
        )
        embed.add_field(name="Fallback Chain", value=" → ".join(available), inline=True)
        
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="ping", description="Check the bot's latency")
    async def ping(self, interaction: discord.Interaction):
        latency = round(self.bot.latency * 1000)
        embed = discord.Embed(
            title="🏓 Pong!",
            description=f"Latency: `{latency}ms`",
            color=discord.Color.green() if latency < 200 else discord.Color.orange()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="stats", description="Show bot statistics")
    async def stats(self, interaction: discord.Interaction):
        embed = discord.Embed(title="📊 SparkSage Statistics", color=discord.Color.purple())
        embed.add_field(name="Servers", value=str(len(self.bot.guilds)), inline=True)
        embed.add_field(name="Latency", value=f"{round(self.bot.latency * 1000)}ms", inline=True)
        primary = config.AI_PROVIDER
        provider_info = config.PROVIDERS.get(primary, {})
        embed.add_field(name="Primary Provider", value=provider_info.get('name', primary), inline=True)
        try:
            total_messages = await database.get_total_messages()
            embed.add_field(name="Total Messages", value=str(total_messages), inline=True)
        except Exception:
            pass
        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(General(bot))