from discord.ext import commands

class TriviaCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        print("✅ TRIVIA PLUGIN LOADED!")
    
    @commands.command(name="trivia")
    async def trivia(self, ctx):
        await ctx.send("✅ Trivia plugin works! (Coming soon)")

async def setup(bot):
    await bot.add_cog(TriviaCog(bot))