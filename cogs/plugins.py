from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user
import plugins.loader as plugin_loader
from bot import get_bot

# Remove the prefix from here - it's already in main.py
router = APIRouter()  # Just empty router, no prefix


@router.get("")  # This becomes /api/plugins (from main.py prefix + "")
async def list_plugins(user=Depends(get_current_user)):
    """List all available plugins"""
    return plugin_loader.list_plugins()


@router.post("/{name}/enable")  # This becomes /api/plugins/{name}/enable
async def enable_plugin(name: str, user=Depends(get_current_user)):
    """Enable and load a plugin"""
    # First mark as enabled
    plugin_loader.enable_plugin(name)
    
    # Get the bot instance
    bot = get_bot()
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized")
    
    # Actually load the plugin
    success = await plugin_loader.load_plugin(bot, name)
    
    if not success:
        # If loading failed, revert the enabled state
        plugin_loader.disable_plugin(name)
        raise HTTPException(status_code=400, detail=f"Failed to load plugin: {name}")
    
    return {"name": name, "enabled": True, "loaded": True}


@router.post("/{name}/disable")
async def disable_plugin(name: str, user=Depends(get_current_user)):
    """Disable and unload a plugin"""
    # Get the bot instance
    bot = get_bot()
    
    # Try to unload if bot exists
    unloaded = False
    if bot:
        unloaded = await plugin_loader.unload_plugin(bot, name)
    
    # Mark as disabled regardless
    plugin_loader.disable_plugin(name)
    
    return {
        "name": name, 
        "enabled": False, 
        "unloaded": unloaded
    }


@router.post("/{name}/reload")
async def reload_plugin(name: str, user=Depends(get_current_user)):
    """Reload a plugin"""
    bot = get_bot()
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized")
    
    # Unload if loaded
    await plugin_loader.unload_plugin(bot, name)
    
    # Load again
    success = await plugin_loader.load_plugin(bot, name)
    
    if not success:
        plugin_loader.disable_plugin(name)
        raise HTTPException(status_code=400, detail=f"Failed to reload plugin: {name}")
    
    # Make sure it's enabled
    plugin_loader.enable_plugin(name)
    
    return {"name": name, "enabled": True, "reloaded": True}