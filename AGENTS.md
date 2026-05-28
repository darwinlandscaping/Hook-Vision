# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

HookVision is a pnpm-workspaces monorepo containing AI-powered fishing apps (Expo/React Native), a web dashboard (Vite + React), a promotional site (Vite + Three.js), and an Express.js API server. See `replit.md` for the full architecture and service map.

### Prerequisites

- **Node.js 24** (specified in `.replit`; installed via nvm)
- **pnpm 10.x** (enforced by root `preinstall` script — npm/yarn are rejected)
- **PostgreSQL 16** with a database named `hookvision`

### Environment variables

| Variable | Required by | Notes |
|---|---|---|
| `DATABASE_URL` | `@workspace/db`, API server | `postgresql://postgres:postgres@localhost:5432/hookvision` for local dev |
| `PORT` | API server, Vite apps | API server uses `3001`; hookvision-web uses `25355` |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API server | Set to `https://api.openai.com/v1` (or a mock) — server will not start without it |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API server | Required at import time; placeholder value allows server to start (AI features will 401) |
| `BASE_PATH` | Vite web apps | Set to `/` for local dev |
| `NODE_ENV` | API server | `development` for local dev |

### Running services

**API server:**
```
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hookvision"
export PORT=3001 NODE_ENV=development
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
export AI_INTEGRATIONS_OPENAI_API_KEY="sk-placeholder"
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

**Web dashboard (hookvision-web):**
```
export PORT=25355 BASE_PATH="/"
pnpm --filter @workspace/hookvision-web run dev
```

### Key gotchas

- The API server's `dev` script runs in an infinite restart loop (`while true; do node ...; done`). For one-shot testing, use `build` then `start` separately.
- `better-sqlite3` native addon must be compiled after `pnpm install`. Run `cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release` if the postinstall was skipped.
- The `pnpm install` may show "Ignored build scripts" warnings for `better-sqlite3`, `esbuild`, and `msedge-tts`. The esbuild binary is bundled and works without its postinstall. `better-sqlite3` needs manual compilation (see above). `msedge-tts` has no native build to run.
- `pnpm run typecheck` has pre-existing type errors in `lib/integrations-openai-ai-server` (missing `@types/node` dependency and OpenAI SDK type issues). The API server still builds and runs fine since it uses esbuild.
- PostgreSQL must be started (`sudo pg_ctlcluster 16 main start`) before running the API server or DB schema push.
- The web dashboard fetches from `/api/*` on the same origin. In Replit, a reverse proxy routes both services behind one domain. When running locally without that proxy, API calls from the web dashboard will fail (the API server on port 3001 still works independently via `curl`). The `/exec-daemon/node` binary shadows nvm's Node.js in the default PATH; prepend `$HOME/.nvm/versions/node/v24.16.0/bin` to PATH to use Node 24.

### Useful commands

See `replit.md` for the full command reference. Key ones:
- `pnpm run typecheck` — type-check all packages
- `pnpm run build` — type-check + build all packages
- `pnpm --filter @workspace/db run push` — push Drizzle schema to PostgreSQL
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas from OpenAPI spec
