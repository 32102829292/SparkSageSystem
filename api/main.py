import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. Corrected Router Loading
def get_routers():
    # We use '.' to indicate the current directory (api/)
    from .routes import (
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

# 3. App Definition (Keep it simple for Vercel)
app = FastAPI(title="SparkSage API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers immediately
for router, prefix, tag in get_routers():
    app.include_router(router, prefix=prefix, tags=[tag])

@app.get("/api/health")
async def health():
    return {"status": "ok", "python": "3.13", "time": time.time()}

# 4. Local Execution (Bot + API) - Vercel ignores this block
if __name__ == "__main__":
    import uvicorn
    import asyncio
    # Only try to start bot if running locally
    uvicorn.run(app, host="0.0.0.0", port=8000)