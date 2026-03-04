from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os
import logging
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SparkSage API")
    start_time = time.time()

    import db
    try:
        if hasattr(db, 'create_pool'):
            app.state.db_pool = await db.create_pool()
        else:
            await db.init_db()
            await db.sync_env_to_db()
            app.state.db_pool = None
    except Exception as e:
        logger.error(f"Failed to initialize DB: {e}")
        raise

    logger.info(f"Startup completed in {time.time() - start_time:.2f}s")
    yield

    logger.info("Shutting down SparkSage API")
    try:
        if hasattr(app.state, 'db_pool') and app.state.db_pool:
            await app.state.db_pool.close()
        else:
            import db
            await db.close_db()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://spark-sage-system.vercel.app",
    "https://dashboard-zeta-two-34.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]

ALLOWED_ORIGIN_REGEX = r"https://.*gellimaegabuat.*\.vercel\.app"


def create_app() -> FastAPI:
    is_production = os.getenv("ENVIRONMENT") == "production"

    app = FastAPI(
        title="SparkSage API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc"
    )

    # Process time header middleware — runs first, passes through to CORS
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        response.headers["X-Process-Time"] = str(time.time() - start_time)
        return response

    # CORS middleware — handles OPTIONS preflights automatically
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o for o in ALLOWED_ORIGINS if o],
        allow_origin_regex=ALLOWED_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600,
    )

    # Mount static files if they exist
    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")

    # Register routers
    routers = get_routers()
    for router, prefix, tag in routers:
        app.include_router(router, prefix=prefix, tags=[tag])

    # Health check — verifies DB connectivity
    @app.get("/api/health")
    async def health():
        db_ok = False
        try:
            if hasattr(app.state, 'db_pool') and app.state.db_pool:
                await app.state.db_pool.fetchval("SELECT 1")
                db_ok = True
        except Exception as e:
            logger.warning(f"Health check DB ping failed: {e}")

        return {
            "status": "ok" if db_ok else "degraded",
            "db": db_ok,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "timestamp": time.time()
        }

    return app


app = create_app()