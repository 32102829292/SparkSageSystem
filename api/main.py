from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import logging
from typing import Dict
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy imports for faster cold starts
def get_routers():
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

# Connection pool for database
_db_pool = None

async def get_db_pool():
    global _db_pool
    if _db_pool is None:
        import db
        _db_pool = await db.create_pool()  # Assuming you can create a pool
    return _db_pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize connection pool
    logger.info("Starting up SparkSage API")
    start_time = time.time()
    
    import db
    # Use connection pooling if your DB supports it
    if hasattr(db, 'create_pool'):
        app.state.db_pool = await db.create_pool()
    else:
        await db.init_db()
        await db.sync_env_to_db()
    
    logger.info(f"Startup completed in {time.time() - start_time:.2f}s")
    yield
    
    # Shutdown: close connections
    logger.info("Shutting down SparkSage API")
    if hasattr(app.state, 'db_pool'):
        await app.state.db_pool.close()
    else:
        await db.close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title="SparkSage API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if os.getenv("VERCEL_ENV") == "production" else "/docs",
        redoc_url=None if os.getenv("VERCEL_ENV") == "production" else "/redoc"
    )

    # CORS for production
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sparksage.vercel.app",
        os.getenv("FRONTEND_URL", "")
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin for origin in origins if origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount static files if they exist
    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")

    # Lazy load routers
    routers = get_routers()
    for router, prefix, tag in routers:
        app.include_router(router, prefix=prefix, tags=[tag])

    @app.get("/api/health")
    async def health():
        return {
            "status": "ok",
            "environment": os.getenv("VERCEL_ENV", "development"),
            "timestamp": time.time()
        }

    @app.middleware("http")
    async def add_process_time_header(request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

    return app

app = create_app()

# For Vercel serverless
handler = app