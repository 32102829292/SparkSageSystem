from discord.ext import commands

class ExampleCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        print("✅ EXAMPLE PLUGIN LOADED!")
    
    @commands.command(name="example")
    async def example(self, ctx):
        await ctx.send("✅ Example plugin works!")

async def setup(bot):
    await bot.add_cog(ExampleCog(bot))