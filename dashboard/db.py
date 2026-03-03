import os
import json
import asyncpg
from datetime import datetime

# This will be your Supabase Connection String from Settings > Database
DATABASE_URL = os.getenv("DATABASE_URL")

_pool: asyncpg.Pool | None = None

async def get_db():
    global _pool
    if _pool is None:
        # We MUST set statement_cache_size=0 for Supabase/PgBouncer compatibility
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            statement_cache_size=0  # Fixes the "prepared statement already exists" error
        )
    return _pool

async def get_config(key: str, default: str | None = None) -> str | None:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT value FROM config WHERE key = $1", key)
        return row["value"] if row else default

async def set_config(key: str, value: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO config (key, value) 
               VALUES ($1, $2) 
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            key, value
        )

async def add_message(channel_id: str, role: str, content: str, provider: str | None = None):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO conversations (channel_id, role, content, provider) VALUES ($1, $2, $3, $4)",
            str(channel_id), role, content, provider
        )

async def get_messages(channel_id: str, limit: int = 20) -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT role, content, provider, created_at FROM conversations WHERE channel_id = $1 ORDER BY id DESC LIMIT $2",
            str(channel_id), limit
        )
        return [dict(row) for row in reversed(rows)]

async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        
async def init_db():
    """Starts the database pool and creates tables if they don't exist"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            # Create Config Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            # Create Conversations Table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT,
                    role TEXT,
                    content TEXT,
                    provider TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        print("✅ Database connection pool initialized and tables verified.")
        return pool
    except Exception as e:
        print(f"❌ Database failed to start: {e}")
        raise e

async def sync_env_to_db():
    """Syncs local AI provider settings to the Supabase config table"""
    try:
        providers = ["gemini", "groq", "openrouter"]
        for p in providers:
            key = f"{p.upper()}_API_KEY"
            if os.getenv(key):
                await set_config(f"provider_{p}_enabled", "true")
        print("✅ AI provider sync complete.")
    except Exception as e:
        print(f"⚠️ Sync failed: {e}")
        
async def init_db():
    """Starts the database pool and creates tables if they don't exist"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id SERIAL PRIMARY KEY,
                    channel_id TEXT,
                    role TEXT,
                    content TEXT,
                    provider TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        print("✅ Database connection pool initialized and tables verified.")
        return pool
    except Exception as e:
        print(f"❌ Database failed to start: {e}")
        raise e


async def create_session(token: str, user_id: str, expires_at):
    from datetime import datetime
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO sessions (token, user_id, expires_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at""",
            token, user_id, expires_at
        )


async def get_session(token: str) -> dict | None:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()",
            token
        )
        return dict(row) if row else None


async def delete_session(token: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM sessions WHERE token = $1", token)