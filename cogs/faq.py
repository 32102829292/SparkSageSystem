"""cogs/faq.py — FAQ management"""
import discord
from discord import app_commands
from discord.ext import commands
import db as database


class FAQ(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    faq_group = app_commands.Group(name="faq", description="FAQ commands")

    @faq_group.command(name="add", description="Add a FAQ entry")
    @app_commands.describe(question="The question", answer="The answer")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def faq_add(self, interaction: discord.Interaction, question: str, answer: str):
        faq_id = await database.create_faq(question, answer)
        embed = discord.Embed(title="✅ FAQ Added", color=discord.Color.green())
        embed.add_field(name="Q", value=question, inline=False)
        embed.add_field(name="A", value=answer, inline=False)
        embed.set_footer(text=f"FAQ ID: {faq_id}")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @faq_group.command(name="list", description="List all FAQs")
    async def faq_list(self, interaction: discord.Interaction):
        from cogs.permissions import check_command_permission
        if not await check_command_permission(interaction, "faq"):
            await interaction.response.send_message(
                "❌ You don't have permission to use this command.", ephemeral=True
            )
            return

        rows = await database.get_faqs()
        if not rows:
            await interaction.response.send_message("📭 No FAQs yet. Use `/faq add` to create one.", ephemeral=True)
            return
        embed = discord.Embed(title="📚 Server FAQs", color=discord.Color.blurple())
        for row in rows[:25]:
            embed.add_field(
                name=f"#{row['id']} {row['question'][:80]}",
                value=row['answer'][:200],
                inline=False
            )
        await interaction.response.send_message(embed=embed)

    @faq_group.command(name="remove", description="Remove a FAQ by ID")
    @app_commands.describe(faq_id="The FAQ ID from /faq list")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def faq_remove(self, interaction: discord.Interaction, faq_id: int):
        await database.delete_faq(faq_id)
        await interaction.response.send_message(f"✅ FAQ #{faq_id} removed.", ephemeral=True)

    @faq_group.command(name="get", description="Search FAQs for an answer")
    @app_commands.describe(question="Your question")
    async def faq_get(self, interaction: discord.Interaction, question: str):
        from cogs.permissions import check_command_permission
        if not await check_command_permission(interaction, "faq"):
            await interaction.response.send_message(
                "❌ You don't have permission to use this command.", ephemeral=True
            )
            return

        await interaction.response.defer(thinking=True)
        rows = await database.get_faqs()
        if not rows:
            await interaction.followup.send("📭 No FAQs configured yet.")
            return
        q_lower = question.lower()
        best = None
        best_score = 0
        for row in rows:
            score = sum(1 for word in row['question'].lower().split() if word in q_lower)
            if row.get('match_keywords'):
                score += sum(1 for kw in row['match_keywords'].lower().split(',') if kw.strip() in q_lower)
            if score > best_score:
                best_score = score
                best = row
        if best and best_score > 0:
            embed = discord.Embed(title="❓ FAQ Answer", description=best['answer'], color=discord.Color.blurple())
            embed.set_footer(text=f"Matched: {best['question']}")
            await interaction.followup.send(embed=embed)
        else:
            await interaction.followup.send("🤷 No matching FAQ found. Try `/ask` instead.")


async def setup(bot):
    await bot.add_cog(FAQ(bot))