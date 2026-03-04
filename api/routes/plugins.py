from fastapi import APIRouter, Depends
from api.deps import get_current_user
import plugins.loader as plugin_loader
import logging
import json
import time
import os

logger = logging.getLogger('sparksage')
router = APIRouter()

SIGNAL_FILE = "/tmp/plugin_reload_signal.json"


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