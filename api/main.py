import os
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# --- 1. Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 2. Lazy Router Loading ---
def get_routers():
    # Import inside the function to keep Vercel cold starts fast
    from api.routes import (
        auth, config, providers, bot, conversations, wizard,
        analytics, faqs, permissions, plugins, custom_commands,
        digest, moderation, channel_prompts, channel_providers, rate_limits
    )
    return [
        (auth.router, "/api/auth", "auth"),
        (config.router, "/api/config", "config"),
        (providers.router, "/api/providers", "providers"),
        (bot.router, "/api/bot", "bot"),
        (conversations.router, "/api/conversations", "conversations"),
        (analytics.router, "/api/analytics", "analytics"),
        (wizard.router, "/api/wizard", "wizard"),
        (faqs.router, "/api/faqs", "faqs"),
        (permissions.router, "/api/permissions", "permissions"),
        (plugins.router, "/api/plugins", "plugins"),
        (custom_commands.router, "/api/custom-commands", "custom-commands"),
        (digest.router, "/api/digest", "digest"),
        (moderation.router, "/api/moderation", "moderation"),
        (channel_prompts.router, "/api/channel-prompts", "channel-prompts"),
        (channel_providers.router, "/api/channel-providers", "channel-providers"),
        (rate_limits.router, "/api/rate-limits", "rate-limits"),
    ]

# --- 3. Lifespan (DB Connection) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SparkSage API")
    import db
    if hasattr(db, 'create_pool'):
        app.state.db_pool = await db.create_pool()
    else:
        await db.init_db()
        await db.sync_env_to_db()
    
    yield
    
    logger.info("Shutting down SparkSage API")
    if hasattr(app.state, 'db_pool'):
        await app.state.db_pool.close()
    else:
        await db.close_db()

# --- 4. App Factory ---
def create_app() -> FastAPI:
    app = FastAPI(
        title="SparkSage API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if os.getenv("VERCEL_ENV") == "production" else "/docs"
    )

    # CORS
    origins = [
        "http://localhost:3000",
        "https://sparksage.vercel.app",
        os.getenv("FRONTEND_URL", "")
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o for o in origins if o],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")

    # Register Routers
    for router, prefix, tag in get_routers():
        app.include_router(router, prefix=prefix, tags=[tag])

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "python": "3.13", "time": time.time()}

    return app

app = create_app()

# --- 5. Local Execution (Bot + API) ---
# This block is ignored by Vercel, but runs when you do 'python api/main.py'
if __name__ == "__main__":
    import uvicorn
    # Make sure you have a file named bot_instance.py that exports 'bot'
    try:
        from api.bot_instance import bot_client 
    except ImportError:
        logger.warning("Bot instance not found. Starting API only.")
        bot_client = None

    async def run_combined():
        if bot_client:
            token = os.getenv("DISCORD_TOKEN")
            if token:
                logger.info("Starting Discord Bot...")
                asyncio.create_task(bot_client.start(token))
            else:
                logger.error("DISCORD_TOKEN missing in .env")

        logger.info("Starting FastAPI Server...")
        config = uvicorn.Config(app, host="0.0.0.0", port=8000)
        server = uvicorn.Server(config)
        await server.serve()

    try:
        asyncio.run(run_combined())
    except KeyboardInterrupt:
        pass