from __future__ import annotations

import os
import json
import logging
from typing import Optional
from discord.ext import commands

logger = logging.getLogger("sparksage")

PLUGINS_DIR = os.path.join(os.path.dirname(__file__), "available")
PLUGINS_STATE_FILE = os.path.join(os.path.dirname(__file__), "plugins_state.json")


def _load_state() -> dict:
    """Load plugin enabled/disabled state from file."""
    if os.path.exists(PLUGINS_STATE_FILE):
        try:
            with open(PLUGINS_STATE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_state(state: dict):
    """Save plugin enabled/disabled state to file."""
    try:
        with open(PLUGINS_STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save plugin state: {e}")


def list_plugins() -> list[dict]:
    """List all available plugins and their status."""
    state = _load_state()
    plugins = []

    if not os.path.exists(PLUGINS_DIR):
        os.makedirs(PLUGINS_DIR, exist_ok=True)
        return plugins

    for filename in os.listdir(PLUGINS_DIR):
        if filename.endswith(".py") and not filename.startswith("_"):
            name = filename[:-3]
            plugins.append({
                "name": name,
                "enabled": state.get(name, True),  # ✅ enabled by default
                "filename": filename,
            })

    return plugins


def enable_plugin(name: str):
    """Mark a plugin as enabled in state."""
    state = _load_state()
    state[name] = True
    _save_state(state)
    logger.info(f"Plugin '{name}' marked as enabled")


def disable_plugin(name: str):
    """Mark a plugin as disabled in state."""
    state = _load_state()
    state[name] = False
    _save_state(state)
    logger.info(f"Plugin '{name}' marked as disabled")


async def load_plugin(bot: commands.Bot, name: str) -> bool:
    """Load a plugin cog into the bot."""
    extension = f"plugins.available.{name}"
    try:
        if extension in bot.extensions:
            await bot.reload_extension(extension)
            logger.info(f"Reloaded plugin: {name}")
        else:
            await bot.load_extension(extension)
            logger.info(f"Loaded plugin: {name}")
        return True
    except Exception as e:
        logger.error(f"Failed to load plugin '{name}': {e}")
        return False


async def unload_plugin(bot: commands.Bot, name: str) -> bool:
    """Unload a plugin cog from the bot."""
    extension = f"plugins.available.{name}"
    try:
        if extension in bot.extensions:
            await bot.unload_extension(extension)
            logger.info(f"Unloaded plugin: {name}")
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to unload plugin '{name}': {e}")
        return False


async def load_enabled_plugins(bot: commands.Bot):
    """Load all enabled plugins on bot startup."""
    plugins = list_plugins()  # ✅ scans folder first
    for plugin in plugins:
        if plugin["enabled"]:
            success = await load_plugin(bot, plugin["name"])
            if not success:
                logger.warning(f"Failed to auto-load plugin: {plugin['name']}")