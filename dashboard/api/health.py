from fastapi import FastAPI
import time

app = FastAPI()

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "timestamp": time.time(),
        "service": "sparksage"
    }

# Vercel handler
handler = app