# Repository Guidelines

## Project Structure & Module Organization
The core application lives under `AIStudio/`, a Node 18+ monorepo comprised of `backend/` (NestJS API, Prisma workers, MCP server), `frontend/` (Vite + React UI), and `shared/` (schema objects reused by both stacks). Docs live in `AIStudio/docs/`, UI specs in `AIStudio/e2e/`, automation roots (`scripts/`, `monitoring/`, `livetranslator/`, `whatsapp-bot/`) at repo top—touch only when needed. Container orchestration details for every project live in `DOCKER_MANAGEMENT.md`; read it before toggling services.

## Build, Test, and Development Commands
Run `npm install` once at `AIStudio/` root to hydrate every workspace. Common flows: `npm run dev` (backend + frontend concurrently), `npm run build`, `npm run lint`, and `npm run typecheck`. Database migrations and seeds stay namespaced (e.g., `npm run db:migrate:dev --workspace=backend`). End-to-end utilities include `npm run test:e2e` and `npm run test:e2e:headed`.

## Coding Style & Naming Conventions
Prettier (`.prettierrc.json`) governs layout—2-space indentation, single quotes, trailing commas, print width 100—and runs through `lint-staged` alongside ESLint (`@typescript-eslint`). Use PascalCase for React components (`frontend/src/components/WorkflowCard.tsx`), camelCase for hooks/utilities, and the `feature/feature.service.ts` convention for NestJS providers. Keep shared DTOs/types inside `shared/src`; never push backend-only helpers into shared packages.

## Testing Guidelines
Backend and worker modules rely on Jest, with unit files ending in `.spec.ts` beside their implementations; frontend unit tests use Vitest and Testing Library under `frontend/src/**/__tests__`. Browser-level stories live in `AIStudio/e2e/*.spec.ts`, often paired with `.COVERAGE.md` notes for dashboards such as `09-code-quality-dashboard`. Before submitting, run `npm run test --workspaces`, `npm run test:coverage`, and add `npm run test:e2e` when UI or workflow changes apply. Keep coverage at or above documented baselines by validating with `node verify-coverage-metrics.ts` or `node check-specific-coverage.ts`.

## Commit & Pull Request Guidelines
Follow the existing format shown in `git log`: `type: short summary [ticket]` (e.g., `feat: Improve workflow filters [ST-14]`). Commits should stay narrow and reference Jira/Linear IDs when applicable. Pull requests must explain the motivation, outline major changes, supply testing evidence (command output or URLs), and attach UI screenshots or recordings whenever the frontend shifts. Link the affected docs in `/AIStudio/docs` and flag required migrations or toggles.

## Security & Configuration Tips
Use `.env.example` as the contract for required variables and keep real secrets in `secrets/` or your vault—never commit plaintext credentials. When touching infrastructure, monitoring, or shared Docker stacks, record the change inside the matching guide (for example, `AIStudio/DOCKER_MANAGEMENT.md` or `AIStudio/DEPLOYMENT_GUIDE.md`). Prefer `docker compose logs -f` for service debugging and scrub sensitive lines before sharing them.
