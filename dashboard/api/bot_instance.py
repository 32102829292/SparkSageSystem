import discord
from discord.ext import commands

intents = discord.Intents.default()
bot_client = commands.Bot(command_prefix="!", intents=intents)

@bot_client.event
async def on_ready():
    print(f'Bot logged in as {bot_client.user}')