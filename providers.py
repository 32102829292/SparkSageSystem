from __future__ import annotations

import time
from openai import OpenAI
import config


def _create_client(provider_name: str) -> OpenAI | None:
    provider = config.PROVIDERS.get(provider_name)
    if not provider or not provider["api_key"]:
        return None

    extra_headers = {}
    if provider_name == "anthropic":
        extra_headers["anthropic-version"] = "2023-06-01"

    return OpenAI(
        base_url=provider["base_url"],
        api_key=provider["api_key"],
        default_headers=extra_headers or None,
    )


def _build_fallback_order() -> list[str]:
    primary = config.AI_PROVIDER
    order = [primary]
    for name in config.FREE_FALLBACK_CHAIN:
        if name not in order:
            order.append(name)
    return order


def _build_clients() -> dict[str, OpenAI]:
    clients = {}
    for name in set([config.AI_PROVIDER] + config.FREE_FALLBACK_CHAIN + list(config.PROVIDERS.keys())):
        client = _create_client(name)
        if client:
            clients[name] = client
    return clients


_clients: dict[str, OpenAI] = _build_clients()
FALLBACK_ORDER = _build_fallback_order()


def reload_clients():
    global _clients, FALLBACK_ORDER
    _clients = _build_clients()
    FALLBACK_ORDER = _build_fallback_order()


def get_available_providers() -> list[str]:
    return [name for name in FALLBACK_ORDER if name in _clients]


def test_provider(name: str) -> dict:
    provider = config.PROVIDERS.get(name)
    if not provider:
        return {"success": False, "latency_ms": 0, "error": f"Unknown provider: {name}"}

    client = _clients.get(name) or _create_client(name)
    if not client:
        return {"success": False, "latency_ms": 0, "error": "No API key configured"}

    start = time.time()
    try:
        client.chat.completions.create(
            model=provider["model"],
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )
        return {"success": True, "latency_ms": int((time.time() - start) * 1000), "error": None}
    except Exception as e:
        return {"success": False, "latency_ms": int((time.time() - start) * 1000), "error": str(e)}


def call_provider(provider_name: str, messages: list[dict], system_prompt: str) -> tuple[str, str]:
    """Call a specific provider directly, without fallback. Raises on failure."""
    client = _clients.get(provider_name)
    if not client:
        raise RuntimeError(f"Provider '{provider_name}' not configured or unavailable")

    provider = config.PROVIDERS[provider_name]
    response = client.chat.completions.create(
        model=provider["model"],
        max_tokens=config.MAX_TOKENS,
        messages=[
            {"role": "system", "content": system_prompt},
            *messages,
        ],
    )
    return response.choices[0].message.content, provider_name


def chat(messages: list[dict], system_prompt: str) -> tuple[str, str]:
    """Send messages to AI with fallback chain. Returns (response_text, provider_name)."""
    errors = []

    for provider_name in FALLBACK_ORDER:
        client = _clients.get(provider_name)
        if not client:
            continue

        provider = config.PROVIDERS[provider_name]
        try:
            response = client.chat.completions.create(
                model=provider["model"],
                max_tokens=config.MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *messages,
                ],
            )
            return response.choices[0].message.content, provider_name
        except Exception as e:
            errors.append(f"{provider['name']}: {e}")
            continue

    raise RuntimeError(f"All providers failed:\n" + "\n".join(errors))