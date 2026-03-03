from discord.ext import commands
import discord

class TestCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        print("🎉 TEST PLUGIN LOADED SUCCESSFULLY!")
    
    @commands.command(name="test")
    async def test(self, ctx):
        await ctx.send("✅ Plugin system is working!")

async def setup(bot):
    await bot.add_cog(TestCog(bot))