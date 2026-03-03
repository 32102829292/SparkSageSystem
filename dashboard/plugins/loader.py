import json
import os
import importlib
from pathlib import Path
from discord.ext import commands

PLUGINS_DIR = Path("plugins")
_loaded_plugins = {}
_disabled_plugins: set = set()

print(f"🔧 Plugin loader initialized")
print(f"📁 Plugins directory: {PLUGINS_DIR.absolute()}")
print(f"📁 Directory exists: {PLUGINS_DIR.exists()}")


def get_plugin_manifest(plugin_name: str) -> dict | None:
    manifest_path = PLUGINS_DIR / plugin_name / "manifest.json"
    if not manifest_path.exists():
        return None
    try:
        with open(manifest_path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def list_plugins() -> list[dict]:
    plugins = []
    if not PLUGINS_DIR.exists():
        return plugins
    
    for item in PLUGINS_DIR.iterdir():
        if item.is_dir() and (item / "manifest.json").exists():
            manifest = get_plugin_manifest(item.name)
            if manifest:
                manifest["name"] = item.name
                manifest["enabled"] = item.name in _loaded_plugins and item.name not in _disabled_plugins
                plugins.append(manifest)
    return plugins


def enable_plugin(plugin_name: str):
    _disabled_plugins.discard(plugin_name)


def disable_plugin(plugin_name: str):
    _disabled_plugins.add(plugin_name)


async def load_plugin(bot, plugin_name: str) -> bool:
    print(f"\n🔄 Attempting to load plugin: {plugin_name}")
    manifest = get_plugin_manifest(plugin_name)
    if not manifest:
        print(f"❌ No manifest found for {plugin_name}")
        return False
    
    cog_file = manifest.get("cog", f"{plugin_name}.py")
    print(f"  Cog file: {cog_file}")
    
    # Remove .py extension for import
    cog_module = cog_file.replace('.py', '')
    cog_path = f"plugins.{plugin_name}.{cog_module}"
    print(f"  Import path: {cog_path}")
    
    try:
        # Check if file exists
        file_path = PLUGINS_DIR / plugin_name / cog_file
        print(f"  File exists: {file_path.exists()}")
        
        # Check if already loaded
        for cog_name in list(bot.cogs.keys()):
            if plugin_name.lower() in cog_name.lower():
                print(f"  ⚠️ Plugin already loaded, unloading first...")
                try:
                    await bot.unload_extension(cog_path)
                except:
                    pass
        
        # Load the extension
        await bot.load_extension(cog_path)
        _loaded_plugins[plugin_name] = manifest
        print(f"  ✅ Successfully loaded plugin: {plugin_name}")
        print(f"  Available cogs: {list(bot.cogs.keys())}")
        return True
    except commands.ExtensionAlreadyLoaded:
        print(f"  ⚠️ Extension already loaded, reloading...")
        try:
            await bot.reload_extension(cog_path)
            _loaded_plugins[plugin_name] = manifest
            print(f"  ✅ Successfully reloaded plugin: {plugin_name}")
            return True
        except Exception as e:
            print(f"  ❌ Failed to reload: {e}")
            return False
    except ImportError as e:
        print(f"  ❌ ImportError: {e}")
        print(f"  Check that the file exists at: plugins/{plugin_name}/{cog_file}")
        return False
    except Exception as e:
        print(f"  ❌ Failed to load plugin {plugin_name}: {type(e).__name__}: {e}")
        return False


async def unload_plugin(bot, plugin_name: str) -> bool:
    print(f"\n🔄 Attempting to unload plugin: {plugin_name}")
    if plugin_name not in _loaded_plugins:
        print(f"❌ Plugin {plugin_name} not loaded")
        return False
    
    manifest = _loaded_plugins[plugin_name]
    cog_file = manifest.get("cog", f"{plugin_name}.py")
    cog_module = cog_file.replace('.py', '')
    cog_path = f"plugins.{plugin_name}.{cog_module}"
    
    try:
        await bot.unload_extension(cog_path)
        del _loaded_plugins[plugin_name]
        print(f"  ✅ Successfully unloaded plugin: {plugin_name}")
        return True
    except Exception as e:
        print(f"  ❌ Failed to unload plugin {plugin_name}: {e}")
        return False


def get_loaded_plugins():
    return list(_loaded_plugins.keys())


def is_plugin_enabled(plugin_name: str) -> bool:
    return plugin_name in _loaded_plugins and plugin_name not in _disabled_plugins


# Run discovery on import
print("\n🏁 Running initial plugin discovery...")
initial_plugins = list_plugins()
print(f"✅ Plugin loader ready with {len(initial_plugins)} plugins found")