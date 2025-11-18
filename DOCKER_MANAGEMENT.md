# Docker Management Cheat Sheet

Keep this file handy when orchestrating containers on this host. Commands assume `/opt/stack` as the working directory unless noted.

## Global Practices
- Prefer `docker compose` (plugin syntax). Use `-f <file>` when a project exposes multiple configs (for example, `docker compose -f docker-compose.prod.yml up -d`).
- Run `docker compose ps` or `docker compose logs -f <service>` from the same folder that launched the stack so env files and relative paths resolve correctly.
- Most projects join the external bridge network `stack_appnet`. Create it once with `docker network create stack_appnet` on a new machine.
- Keep `.env` files in sync with the corresponding `.env.example` and place secrets in `/opt/stack/secrets/` when referenced.

## Root Automation Stack (`/opt/stack/docker-compose.yml`)
- Services: `n8n` + Postgres, Astro prod/dev sites, Umami analytics, MCP sidecar, WhatsApp bot wrapper, Portainer, Watchtower, LiteLLM, and Open-WebUI.
- Start/stop: `docker compose up -d` / `docker compose down`.
- Persistent data lives under `/opt/{n8n,astro,umami,portainer,litellm}`. Watchtower auto-refreshes images labeled with `com.centurylinklabs.watchtower.enable=true`.

## AIStudio Monorepo (`/opt/stack/AIStudio`)
- Dev stack: `docker compose up -d` brings up Postgres (5433), Redis (6380), backend (3001), and frontend (5174). Same commands exposed as `npm run docker:up` / `npm run docker:down`.
- Prod stack: `docker compose -f docker-compose.prod.yml up -d --build` using `backend/Dockerfile.prod` and `frontend/Dockerfile.prod`. Requires `.env` with `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and proxy URLs.
- Both stacks join `stack_appnet` so other services (for example, `mcp`) can talk to them directly.

## Live Translator Platform (`/opt/stack/livetranslator`)
- Complex compose defining Postgres, Redis, FastAPI API, STT/MT/TTS workers, persistence/cost trackers, and scheduled services. Uses bind-mounted volumes under `/opt/stack/livetranslator/data`.
- Requires `.env` plus secret files under `/opt/stack/secrets` (JWT, Google OAuth, cloud keys). Start with `docker compose up -d`; monitor with `docker compose logs -f api` or per worker.
- Playwright suite runs only when requested: `docker compose --profile test up playwright`.

## WhatsApp Bot Bridge (`/opt/stack/whatsapp-bot`)
- Lightweight stack exposing the OpenWA container and a translator microservice, both on `stack_appnet`. Default webhook: `http://translator:8000/wa/webhook`.
- Bring it up with `docker compose up -d` from `whatsapp-bot/`. Provide `OPENAI_API_KEY` (and other overrides) via `.env` in that folder.

## Legacy AI Studio (`/opt/stack/aistudio.old`)
- Contains Postgres + FastAPI backend + React web client. Only start when legacy endpoints are needed: `docker compose up -d` from `aistudio.old/`.
- Shares `stack_appnet`, so confirm port assignments do not clash with the current AIStudio stack before launching.

## Miscellaneous Notes
- `livetranslator/docker-compose.test.yml` mirrors the prod stack but targets automated test harnesses: `docker compose -f docker-compose.test.yml up`.
- The `mcp/` folder builds the MCP sidecar image consumed by the root compose (`mcp` service). Rebuild via `docker compose build mcp` before a restart when you change that code.
