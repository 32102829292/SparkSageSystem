import os
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy imports for faster cold starts and avoiding circular dependencies
def get_routers():
    from api.routes import (
        auth, config, providers, bot, conversations, wizard,
        analytics, faqs, permissions, plugins, custom_commands,
        digest, moderation, channel_prompts, channel_providers, rate_limits,
        onboarding, cost_tracking
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
        (onboarding.router, "/api/onboarding", "onboarding"),
        (cost_tracking.router, "/api/cost-tracking", "cost-tracking"),
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

def create_app() -> FastAPI:
    is_production = os.getenv("ENVIRONMENT") == "production"

    app = FastAPI(
        title="SparkSage API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc"
    )

    # --- MIDDLEWARE ORDER ---
    # FastAPI executes middleware in reverse order of definition for "http" type.

    # 1. Standard CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Open for debugging; change to specific domains later
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # 2. Process time header
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

    # 3. Explicit Manual Preflight Handler (Crucial for Vercel -> Railway)
    @app.middleware("http")
    async def handle_options_preflight(request: Request, call_next):
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin", "*")
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
                    "Access-Control-Allow-Credentials": "true",
                },
            )
        return await call_next(request)

    # Mount static files if directory exists
    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")

    # Register all routers
    for router, prefix, tag in get_routers():
        app.include_router(router, prefix=prefix, tags=[tag])

    @app.get("/api/health")
    async def health():
        return {
            "status": "ok",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "timestamp": time.time()
        }

    return app

# --- THIS LINE IS THE MOST IMPORTANT ---
# It must be at the bottom and NOT indented.
app = create_app()