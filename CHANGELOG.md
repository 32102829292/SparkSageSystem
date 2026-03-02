# Changelog

## [0.3.0] - 2026-02-19

### Added
- **Admin Dashboard** — Next.js 16 + shadcn/ui web interface for managing SparkSage
- **Setup Wizard** — 4-step guided setup on first login (Discord token → Providers → Bot settings → Review). Skippable and accessible from sidebar nav.
- **FastAPI Backend** — 19 REST API endpoints for dashboard communication
- **SQLite Database** (`db.py`) — persistent storage for config, conversations, sessions, and wizard state
- **Dashboard Pages:**
  - **Overview** — bot status, latency, guild count, active provider, fallback chain visualization, recent activity
  - **Providers** — provider cards with test/set-primary buttons, fallback chain display
  - **Settings** — live config editor with save/reset (changes apply without restart)
  - **Conversations** — per-channel viewer with chat-style messages, provider badges, timestamps
- **Authentication** — Discord OAuth2 (primary) + password fallback (dev/local) via next-auth v5
- **Unified Launcher** (`run.py`) — starts Discord bot + FastAPI server in one process
- **Live Config Reload** — `config.reload_from_db()` and `providers.reload_clients()` for runtime updates
- **Provider Testing** — `providers.test_provider()` for validating API keys from the dashboard
- **Bot Status API** — `bot.get_bot_status()` exposes online state, latency, guilds to dashboard

### Changed
- **`bot.py`** — conversations now stored in SQLite (previously in-memory), added `get_bot_status()`
- **`config.py`** — added dashboard env vars, `reload_from_db()`, `_build_providers()` for dynamic rebuilds
- **`providers.py`** — added `reload_clients()`, `test_provider()`, extracted `_build_clients()`
- **`requirements.txt`** — added fastapi, uvicorn, aiosqlite, pyjwt, python-multipart, httpx
- **`.env.example`** — added DASHBOARD section (port, password, Discord OAuth, JWT secret, DB path)
- **`.gitignore`** — added *.db, dashboard/node_modules/, dashboard/.next/, dashboard/.env.local
- **`docs/PRODUCT_DESIGN.md`** — full rewrite with dashboard architecture, API endpoints, database schema, updated roadmap

### Architecture

```
Before (v0.2):
  Discord → bot.py → providers.py → AI APIs
  Config: .env only, in-memory conversations

After (v0.3):
  Discord → bot.py ──┐
                      ├── providers.py → AI APIs
  Dashboard → FastAPI ┘
                │
            SQLite DB (config, conversations, sessions, wizard)
```

### Files Added

| File | Description |
|------|-------------|
| `db.py` | SQLite database layer (aiosqlite) |
| `run.py` | Unified launcher (bot + FastAPI) |
| `api/main.py` | FastAPI app factory with CORS |
| `api/auth.py` | JWT + password auth utilities |
| `api/deps.py` | Dependency injection |
| `api/routes/auth.py` | Login + user endpoints |
| `api/routes/config.py` | Config CRUD endpoints |
| `api/routes/providers.py` | Provider management + test endpoints |
| `api/routes/bot.py` | Bot status endpoint |
| `api/routes/conversations.py` | Conversation CRUD endpoints |
| `api/routes/wizard.py` | Setup wizard endpoints |
| `dashboard/` | Full Next.js + shadcn/ui admin dashboard (23 UI components, 4 wizard steps, 4 dashboard pages, auth, sidebar nav) |

---

## [0.2.0] - 2026-02-18

### Added
- **Multi-provider fallback system** (`providers.py`) — automatic failover across free AI providers
- **Free fallback chain:** Google Gemini 2.5 Flash → Groq (Llama 3.3 70B) → OpenRouter (DeepSeek R1)
- **Paid provider support** (optional): Anthropic Claude and OpenAI as configurable primary providers
- **`/provider` slash command** — shows active provider, model, and fallback chain status
- **Response footer** — each reply shows which AI provider generated the answer
- **Provider health check on startup** — logs active provider and full fallback chain

### Changed
- **`requirements.txt`** — replaced `anthropic` SDK with `openai` SDK (OpenAI-compatible, works with all providers)
- **`config.py`** — expanded from single-provider to multi-provider config with `PROVIDERS` dict and `FREE_FALLBACK_CHAIN`
- **`.env.example`** — now includes all 5 providers (3 free + 2 paid) with setup links and rate limit notes
- **`bot.py`** — refactored `ask_claude()` → `ask_ai()`, removed Anthropic-specific code, integrated `providers.py`
- **`docs/PRODUCT_DESIGN.md`** — updated architecture diagram, added provider comparison tables, updated roadmap

### Architecture

```
Before (v0.1):
  Discord → bot.py → Anthropic SDK → Claude API (paid only)

After (v0.2):
  Discord → bot.py → providers.py → OpenAI-compatible SDK
                                       ├── Gemini (free)
                                       ├── Groq (free)
                                       ├── OpenRouter (free)
                                       ├── Anthropic (paid, optional)
                                       └── OpenAI (paid, optional)
```

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `providers.py` | **Created** | Multi-provider client with automatic fallback logic |
| `bot.py` | Modified | Refactored to use `providers.py`, added `/provider` command, response footer |
| `config.py` | Modified | Multi-provider config, provider definitions, fallback chain |
| `requirements.txt` | Modified | `anthropic` → `openai` SDK |
| `.env.example` | Modified | All 5 providers with API key placeholders and docs links |
| `.env` | **Created** | Dummy keys for local development |
| `CHANGELOG.md` | **Created** | This file |
| `docs/PRODUCT_DESIGN.md` | Modified | Updated architecture, provider comparison, roadmap |

---

## [0.1.0] - 2026-02-18

### Added
- Initial project setup
- Discord bot with `discord.py`
- Anthropic Claude API integration
- `/ask` slash command
- `/clear` command to reset conversation memory
- `/summarize` command for thread summarization
- Per-channel conversation history (in-memory)
- Configurable model, tokens, and system prompt via `.env`
- Responds to @mentions
- Auto-splits long responses for Discord's 2000 char limit
- Project structure with `cogs/`, `utils/`, `docs/`, `tests/` directories
- Product design document with 7 use case categories and phased roadmap

## [0.4.0] - 2026-03-02

### Added
- **Complete Phase 3-5 Implementation** — All core, advanced, and polish features now fully implemented

#### Phase 3 — Core Features
- **Cog-Based Modular Command System** — Refactored all commands into separate cog files
- **Code Review with Syntax Highlighting** (`/review`) — Analyzes code snippets for bugs and style issues
- **FAQ Auto-Detection and Response** — Automatically answers frequently asked questions
- **New Member Onboarding Flow** — Configurable welcome messages with AI or custom templates
- **Role-Based Access Control** (`/permissions`) — Restrict commands to specific Discord roles

#### Phase 4 — Advanced Features
- **Daily Digest Scheduler** (`/digest`) — Automatically summarizes daily channel activity
- **Content Moderation Pipeline** (`/moderate`) — Flags problematic messages for review
- **Multi-Language Translation** (`/translate`) — Instantly translates messages between languages
- **Custom System Prompts Per Channel** (`/prompt`) — Different AI personalities per channel
- **Per-Channel Provider Override** (`/channel-provider`) — Different AI providers per channel

#### Phase 5 — Scale & Polish
- **Analytics and Usage Tracking** (`/analytics`) — Tracks message counts and provider usage
- **Rate Limiting and Quota Management** — Sliding window implementation with per-user/guild limits
- **Plugin System for Community Extensions** — JSON manifests and hot-reloadable cogs
- **Provider Usage Analytics and Cost Tracking** — Token usage and cost estimation
- **Dashboard Responsive Design + Dark Mode** — Mobile-friendly with theme toggle

#### New Dashboard Pages
- **Channel Prompts** — Manage per-channel custom system prompts
- **Channel Providers** — Override AI providers for specific channels
- **Rate Limits** — Monitor usage and quota status
- **Onboarding** — Configure welcome messages for new members
- **FAQ** — Manage frequently asked questions
- **Permissions** — Role-based command access control
- **Plugins** — Enable/disable community extensions
- **Cost Tracking** — View token usage and estimated costs
- **Custom Commands** — Create no-code custom bot commands
- **Daily Digest** — Configure automated channel summaries
- **Moderation** — Review flagged content and set thresholds

#### New Cogs
| File | Description |
|------|-------------|
| `cogs/review.py` | Code review with syntax highlighting |
| `cogs/faq.py` | FAQ auto-detection and management |
| `cogs/onboarding.py` | New member welcome system |
| `cogs/permissions.py` | Role-based access control |
| `cogs/translate.py` | Multi-language translation |
| `cogs/analytics.py` | Usage tracking and statistics |
| `cogs/custom_commands.py` | No-code custom commands |
| `cogs/digest.py` | Daily channel summaries |
| `cogs/moderation.py` | Content moderation pipeline |
| `cogs/channel_prompts.py` | Per-channel system prompts |
| `cogs/channel_providers.py` | Per-channel provider overrides |
| `cogs/rate_limits.py` | Rate limiting and quota management |
| `cogs/plugin_manager.py` | Discord commands for plugin management |

#### New Utilities
| File | Description |
|------|-------------|
| `utils/rate_limiter.py` | Sliding window rate limiting algorithm |
| `plugins/loader.py` | Plugin discovery and loading system |
| `plugins/__init__.py` | Plugin package initialization |

### Changed
- **Database Schema** — Added 8 new tables: `faqs`, `command_permissions`, `custom_commands`, `channel_prompts`, `channel_providers`, `analytics`, `digest_settings`, `moderation_settings`
- **`api/main.py`** — Registered 10 new route modules for Phase 3-5 features
- **`dashboard/src/app/dashboard/`** — Added 10 new dashboard pages for feature management

---

## [0.2.0] - 2026-02-18

### Added
- **Multi-provider fallback system** (`providers.py`) — automatic failover across free AI providers
- **Free fallback chain:** Google Gemini 2.5 Flash → Groq (Llama 3.3 70B) → OpenRouter (DeepSeek R1)
- **Paid provider support** (optional): Anthropic Claude and OpenAI as configurable primary providers
- **`/provider` slash command** — shows active provider, model, and fallback chain status
- **Response footer** — each reply shows which AI provider generated the answer
- **Provider health check on startup** — logs active provider and full fallback chain

### Changed
- **`requirements.txt`** — replaced `anthropic` SDK with `openai` SDK (OpenAI-compatible, works with all providers)
- **`config.py`** — expanded from single-provider to multi-provider config with `PROVIDERS` dict and `FREE_FALLBACK_CHAIN`
- **`.env.example`** — now includes all 5 providers (3 free + 2 paid) with setup links and rate limit notes
- **`bot.py`** — refactored `ask_claude()` → `ask_ai()`, removed Anthropic-specific code, integrated `providers.py`
- **`docs/PRODUCT_DESIGN.md`** — updated architecture diagram, added provider comparison tables, updated roadmap

### Architecture
Before (v0.1):
Discord → bot.py → Anthropic SDK → Claude API (paid only)

After (v0.2):
Discord → bot.py → providers.py → OpenAI-compatible SDK
├── Gemini (free)
├── Groq (free)
├── OpenRouter (free)
├── Anthropic (paid, optional)
└── OpenAI (paid, optional)

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `providers.py` | **Created** | Multi-provider client with automatic fallback logic |
| `bot.py` | Modified | Refactored to use `providers.py`, added `/provider` command, response footer |
| `config.py` | Modified | Multi-provider config, provider definitions, fallback chain |
| `requirements.txt` | Modified | `anthropic` → `openai` SDK |
| `.env.example` | Modified | All 5 providers with API key placeholders and docs links |
| `.env` | **Created** | Dummy keys for local development |
| `CHANGELOG.md` | **Created** | This file |
| `docs/PRODUCT_DESIGN.md` | Modified | Updated architecture, provider comparison, roadmap |

---

## [0.1.0] - 2026-02-18

### Added
- Initial project setup
- Discord bot with `discord.py`
- Anthropic Claude API integration
- `/ask` slash command
- `/clear` command to reset conversation memory
- `/summarize` command for thread summarization
- Per-channel conversation history (in-memory)
- Configurable model, tokens, and system prompt via `.env`
- Responds to @mentions
- Auto-splits long responses for Discord's 2000 char limit
- Project structure with `cogs/`, `utils/`, `docs/`, `tests/` directories
- Product design document with 7 use case categories and phased roadmap
