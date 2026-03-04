import os
import json
import asyncpg
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")

_pool: asyncpg.Pool | None = None


async def get_db():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            statement_cache_size=0  # Required for Supabase/PgBouncer
        )
    return _pool


async def init_db():
    """Start the pool and create all required tables."""
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
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS permissions (
                    id SERIAL PRIMARY KEY,
                    command_name TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    role_id TEXT,
                    UNIQUE(command_name, guild_id)
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS faqs (
                    id SERIAL PRIMARY KEY,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    match_keywords TEXT DEFAULT '',
                    times_used INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS custom_commands (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    response TEXT NOT NULL,
                    description TEXT DEFAULT 'A custom command',
                    guild_id TEXT DEFAULT 'global',
                    enabled BOOLEAN DEFAULT TRUE,
                    times_used INTEGER DEFAULT 0,
                    created_by TEXT DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, guild_id)
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS channel_prompts (
                    channel_id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    system_prompt TEXT NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS channel_providers (
                    channel_id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    provider TEXT NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS analytics (
                    id SERIAL PRIMARY KEY,
                    event_type TEXT,
                    guild_id TEXT,
                    channel_id TEXT,
                    user_id TEXT,
                    provider TEXT,
                    command TEXT,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    estimated_cost FLOAT DEFAULT 0,
                    latency_ms INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        print("✅ Supabase tables verified.")
        return pool
    except Exception as e:
        print(f"❌ Database failed to start: {e}")
        raise


async def sync_env_to_db():
    """Sync env API keys to DB so dashboard can read them."""
    try:
        providers = ["gemini", "groq", "openrouter", "anthropic", "openai"]
        for p in providers:
            key = f"{p.upper()}_API_KEY"
            if os.getenv(key):
                await set_config(f"provider_{p}_enabled", "true")
        print("✅ AI provider sync complete.")
    except Exception as e:
        print(f"⚠️ Sync failed: {e}")


async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# ─── CONFIG ───────────────────────────────────────────────────────────────────

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


async def get_all_config() -> dict[str, str]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT key, value FROM config")
        return {row["key"]: row["value"] for row in rows}


async def set_config_bulk(values: dict[str, str]):
    pool = await get_db()
    async with pool.acquire() as conn:
        for key, value in values.items():
            await conn.execute(
                """INSERT INTO config (key, value)
                   VALUES ($1, $2)
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
                key, str(value)
            )


# ─── WIZARD ───────────────────────────────────────────────────────────────────

async def get_wizard_state() -> dict:
    completed = await get_config("wizard_completed", "false")
    current_step = await get_config("wizard_current_step", "1")
    data_raw = await get_config("wizard_data", "{}")
    try:
        data = json.loads(data_raw)
    except Exception:
        data = {}
    return {
        "completed": completed == "true",
        "current_step": int(current_step),
        "data": data,
    }


async def set_wizard_state(current_step: int = None, data: dict = None, completed: bool = None):
    if completed is not None:
        await set_config("wizard_completed", "true" if completed else "false")
    if current_step is not None:
        await set_config("wizard_current_step", str(current_step))
    if data is not None:
        await set_config("wizard_data", json.dumps(data))


async def sync_db_to_env():
    """Write DB config back to .env file (best-effort)."""
    try:
        all_config = await get_all_config()
        env_path = ".env"
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                lines = f.readlines()
        existing_keys = {}
        for i, line in enumerate(lines):
            if "=" in line and not line.startswith("#"):
                k = line.split("=", 1)[0].strip()
                existing_keys[k] = i
        for key, value in all_config.items():
            upper_key = key.upper()
            if upper_key in existing_keys:
                lines[existing_keys[upper_key]] = f"{upper_key}={value}\n"
            else:
                lines.append(f"{upper_key}={value}\n")
        with open(env_path, "w") as f:
            f.writelines(lines)
    except Exception as e:
        print(f"⚠️ sync_db_to_env failed (non-fatal): {e}")


# ─── SESSIONS ─────────────────────────────────────────────────────────────────

async def create_session(token: str, user_id: str, expires_at):
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


# ─── CONVERSATIONS ────────────────────────────────────────────────────────────

async def add_message(channel_id: str, role: str, content: str, provider: str = None):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO conversations (channel_id, role, content, provider)
               VALUES ($1, $2, $3, $4)""",
            channel_id, role, content, provider
        )


async def get_messages(channel_id: str, limit: int = 20) -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT role, content, provider, created_at
               FROM conversations
               WHERE channel_id = $1
               ORDER BY created_at DESC
               LIMIT $2""",
            channel_id, limit
        )
        return [dict(r) for r in reversed(rows)]


async def clear_messages(channel_id: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM conversations WHERE channel_id = $1", channel_id
        )


async def list_channels() -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT channel_id, COUNT(*) as message_count, MAX(created_at) as last_activity
               FROM conversations
               GROUP BY channel_id
               ORDER BY last_activity DESC"""
        )
        return [dict(r) for r in rows]


async def get_total_messages() -> int:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT COUNT(*) as cnt FROM conversations")
        return row["cnt"] if row else 0


# ─── CHANNEL PROMPTS ──────────────────────────────────────────────────────────

async def get_channel_prompt(channel_id: str) -> str | None:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT system_prompt FROM channel_prompts WHERE channel_id = $1", channel_id
        )
        return row["system_prompt"] if row else None


async def set_channel_prompt(channel_id: str, guild_id: str, system_prompt: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO channel_prompts (channel_id, guild_id, system_prompt)
               VALUES ($1, $2, $3)
               ON CONFLICT (channel_id) DO UPDATE SET system_prompt = EXCLUDED.system_prompt""",
            channel_id, guild_id, system_prompt
        )


async def delete_channel_prompt(channel_id: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM channel_prompts WHERE channel_id = $1", channel_id
        )


# ─── CHANNEL PROVIDERS ────────────────────────────────────────────────────────

async def get_channel_provider(channel_id: str) -> str | None:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT provider FROM channel_providers WHERE channel_id = $1", channel_id
        )
        return row["provider"] if row else None


async def set_channel_provider(channel_id: str, guild_id: str, provider: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO channel_providers (channel_id, guild_id, provider)
               VALUES ($1, $2, $3)
               ON CONFLICT (channel_id) DO UPDATE SET provider = EXCLUDED.provider""",
            channel_id, guild_id, provider
        )


async def delete_channel_provider(channel_id: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM channel_providers WHERE channel_id = $1", channel_id
        )


# ─── FAQS ─────────────────────────────────────────────────────────────────────

async def get_faqs() -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, question, answer, match_keywords, times_used FROM faqs ORDER BY id"
        )
        return [dict(r) for r in rows]


async def create_faq(question: str, answer: str, match_keywords: str = "") -> int:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO faqs (question, answer, match_keywords)
               VALUES ($1, $2, $3) RETURNING id""",
            question, answer, match_keywords
        )
        return row["id"]


async def delete_faq(faq_id: int):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM faqs WHERE id = $1", faq_id)


# ─── PERMISSIONS ──────────────────────────────────────────────────────────────

async def get_permissions() -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, command_name, guild_id, role_id FROM permissions")
        return [dict(r) for r in rows]


async def add_permission(command_name: str, guild_id: str, role_id: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO permissions (command_name, guild_id, role_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (command_name, guild_id) DO UPDATE SET role_id = EXCLUDED.role_id""",
            command_name, guild_id, role_id
        )


async def remove_permission(command_name: str, guild_id: str, role_id: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM permissions WHERE command_name = $1 AND guild_id = $2",
            command_name, guild_id
        )


# ─── CUSTOM COMMANDS ──────────────────────────────────────────────────────────

async def get_custom_commands(guild_id: str = None) -> list[dict]:
    pool = await get_db()
    async with pool.acquire() as conn:
        if guild_id:
            rows = await conn.fetch(
                """SELECT id, name, response, description, guild_id, enabled, times_used
                   FROM custom_commands WHERE guild_id = $1 ORDER BY name""",
                guild_id
            )
        else:
            rows = await conn.fetch(
                "SELECT id, name, response, description, guild_id, enabled, times_used FROM custom_commands ORDER BY name"
            )
        return [dict(r) for r in rows]


async def get_custom_command(name: str, guild_id: str) -> dict | None:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, name, response, description, guild_id, enabled, times_used
               FROM custom_commands
               WHERE name = $1 AND guild_id = $2 AND enabled = TRUE""",
            name.lower(), guild_id
        )
        return dict(row) if row else None


async def create_custom_command(name: str, response: str, description: str = "A custom command",
                                 guild_id: str = "global", created_by: str = "") -> int:
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO custom_commands (name, response, description, guild_id, created_by)
               VALUES ($1, $2, $3, $4, $5) RETURNING id""",
            name.lower(), response, description, guild_id, created_by
        )
        return row["id"]


async def update_custom_command(command_id: int, response: str, description: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE custom_commands SET response = $1, description = $2 WHERE id = $3",
            response, description, command_id
        )


async def toggle_custom_command(command_id: int, enabled: bool):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE custom_commands SET enabled = $1 WHERE id = $2",
            enabled, command_id
        )


async def delete_custom_command(command_id: int):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM custom_commands WHERE id = $1", command_id)


async def increment_custom_command_usage(command_id: int):
    pool = await get_db()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE custom_commands SET times_used = times_used + 1 WHERE id = $1",
            command_id
        )


# ─── ANALYTICS / COSTS ────────────────────────────────────────────────────────

async def get_cost_summary(period: str = "30d") -> dict:
    from datetime import timedelta, timezone
    pool = await get_db()
    async with pool.acquire() as conn:
        now = datetime.now(timezone.utc)
        if period == "today":
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "7d":
            cutoff = now - timedelta(days=7)
        elif period == "30d":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = None

        if cutoff:
            rows = await conn.fetch(
                """SELECT provider, SUM(estimated_cost) as total_cost, COUNT(*) as count
                   FROM analytics WHERE created_at >= $1 GROUP BY provider""",
                cutoff
            )
            total_row = await conn.fetchrow(
                "SELECT SUM(estimated_cost) as total FROM analytics WHERE created_at >= $1",
                cutoff
            )
        else:
            rows = await conn.fetch(
                "SELECT provider, SUM(estimated_cost) as total_cost, COUNT(*) as count FROM analytics GROUP BY provider"
            )
            total_row = await conn.fetchrow("SELECT SUM(estimated_cost) as total FROM analytics")

        by_provider = {(r["provider"] or "unknown"): {"cost": float(r["total_cost"] or 0), "count": r["count"]} for r in rows}
        return {
            "period": period,
            "total_cost": float(total_row["total"] or 0) if total_row else 0.0,
            "by_provider": by_provider,
        }