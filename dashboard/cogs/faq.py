"""cogs/faq.py — FAQ management"""
import discord
from discord import app_commands
from discord.ext import commands
import aiosqlite
import os

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")


async def ensure_faq_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS faqs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                times_used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await db.commit()


class FAQ(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        await ensure_faq_table()

    faq_group = app_commands.Group(name="faq", description="FAQ commands")

    @faq_group.command(name="add", description="Add a FAQ entry")
    @app_commands.describe(question="The question", answer="The answer")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def faq_add(self, interaction: discord.Interaction, question: str, answer: str):
        await ensure_faq_table()
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO faqs (guild_id, question, answer) VALUES (?,?,?)",
                (str(interaction.guild_id), question, answer)
            )
            await db.commit()
            faq_id = cur.lastrowid
        embed = discord.Embed(title="✅ FAQ Added", color=discord.Color.green())
        embed.add_field(name="Q", value=question, inline=False)
        embed.add_field(name="A", value=answer, inline=False)
        embed.set_footer(text=f"FAQ ID: {faq_id}")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @faq_group.command(name="list", description="List all FAQs")
    async def faq_list(self, interaction: discord.Interaction):
        await ensure_faq_table()
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                "SELECT id, question, answer FROM faqs WHERE guild_id=? ORDER BY id",
                (str(interaction.guild_id),)
            )
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
        await ensure_faq_table()
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute(
                "DELETE FROM faqs WHERE id=? AND guild_id=?",
                (faq_id, str(interaction.guild_id))
            )
            await db.commit()
        if cur.rowcount:
            await interaction.response.send_message(f"✅ FAQ #{faq_id} removed.", ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ FAQ #{faq_id} not found.", ephemeral=True)

    @faq_group.command(name="get", description="Search FAQs for an answer")
    @app_commands.describe(question="Your question")
    async def faq_get(self, interaction: discord.Interaction, question: str):
        await ensure_faq_table()
        await interaction.response.defer(thinking=True)
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                "SELECT id, question, answer FROM faqs WHERE guild_id=?",
                (str(interaction.guild_id),)
            )
        if not rows:
            await interaction.followup.send("📭 No FAQs configured yet.")
            return
        q_lower = question.lower()
        best = None
        best_score = 0
        for row in rows:
            score = sum(1 for word in row['question'].lower().split() if word in q_lower)
            if score > best_score:
                best_score = score
                best = row
        if best and best_score > 0:
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute("UPDATE faqs SET times_used=times_used+1 WHERE id=?", (best['id'],))
                await db.commit()
            embed = discord.Embed(title="❓ FAQ Answer", description=best['answer'], color=discord.Color.blurple())
            embed.set_footer(text=f"Matched: {best['question']}")
            await interaction.followup.send(embed=embed)
        else:
            await interaction.followup.send("🤷 No matching FAQ found. Try `/ask` instead.")


async def setup(bot):
    await bot.add_cog(FAQ(bot))