from discord.ext import commands

class WelcomeCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        print("✅ WELCOME PLUGIN LOADED!")
    
    @commands.command(name="welcome")
    async def welcome(self, ctx):
        await ctx.send("✅ Welcome plugin works!")

async def setup(bot):
    await bot.add_cog(WelcomeCog(bot))