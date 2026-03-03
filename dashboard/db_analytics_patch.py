"""
Run this once to add the analytics table to your database.
Usage: python db_analytics_patch.py
"""
import asyncio
import aiosqlite
import os

DB_PATH = os.getenv("DATABASE_PATH", "sparksage.db")

async def patch():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                guild_id TEXT,
                channel_id TEXT,
                user_id TEXT,
                provider TEXT,
                command TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                estimated_cost REAL DEFAULT 0.0,
                latency_ms INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await db.commit()
        print("✅ Analytics table created successfully.")

asyncio.run(patch())