from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import plugins.loader as plugin_loader
import logging
import json
import time
import os
import re

logger = logging.getLogger('sparksage')
router = APIRouter()

SIGNAL_FILE = "/tmp/plugin_reload_signal.json"
PLUGINS_DIR = "plugins"


def _write_signal(name: str, action: str):
    try:
        with open(SIGNAL_FILE, "w") as f:
            json.dump({"plugin": name, "action": action, "ts": time.time()}, f)
    except Exception as e:
        logger.warning(f"Could not write plugin signal: {e}")


@router.get("")
async def list_plugins(user=Depends(get_current_user)):
    return plugin_loader.list_plugins()


@router.post("/{name}/enable")
async def enable_plugin(name: str, user=Depends(get_current_user)):
    plugin_loader.enable_plugin(name)
    _write_signal(name, "load")
    return {"name": name, "enabled": True}


@router.post("/{name}/disable")
async def disable_plugin(name: str, user=Depends(get_current_user)):
    plugin_loader.disable_plugin(name)
    _write_signal(name, "unload")
    return {"name": name, "enabled": False}


@router.post("/{name}/reload")
async def reload_plugin(name: str, user=Depends(get_current_user)):
    plugin_loader.enable_plugin(name)
    _write_signal(name, "load")
    return {"name": name, "enabled": True}


class PluginUpload(BaseModel):
    name: str
    code: str


@router.post("/upload")
async def upload_plugin(payload: PluginUpload, user=Depends(get_current_user)):
    # Sanitize name — lowercase, only alphanumeric + underscores
    name = re.sub(r"[^a-z0-9_]", "_", payload.name.strip().lower())
    if not name:
        raise HTTPException(status_code=400, detail="Invalid plugin name")

    # Basic validation — must have PLUGIN_INFO and setup()
    if "PLUGIN_INFO" not in payload.code:
        raise HTTPException(status_code=400, detail="Plugin must include a PLUGIN_INFO dict")
    if "async def setup" not in payload.code:
        raise HTTPException(status_code=400, detail="Plugin must include 'async def setup(bot)'")

    path = os.path.join(PLUGINS_DIR, f"{name}.py")
    if os.path.exists(path):
        raise HTTPException(status_code=409, detail=f"Plugin '{name}' already exists. Choose a different name.")

    try:
        os.makedirs(PLUGINS_DIR, exist_ok=True)
        with open(path, "w") as f:
            f.write(payload.code)
        logger.info(f"Plugin '{name}' uploaded to {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write plugin file: {e}")

    # Enable it in the DB/config and signal the bot to hot-load it
    try:
        plugin_loader.enable_plugin(name)
    except Exception as e:
        logger.warning(f"Could not enable plugin '{name}' in loader: {e}")

    _write_signal(name, "load")

    return {"status": "ok", "name": name, "path": path}