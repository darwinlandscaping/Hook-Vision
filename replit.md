# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`)

## Artifacts

### HookVision (`artifacts/hookvision`)

A fishing sonar analysis mobile app built with Expo + React Native.

**Features:**
- Upload sonar/fish finder screenshots from the photo library
- AI-powered fish analysis (count, depth, species, casting advice) via OpenAI GPT vision
- Animated sonar pulse UI with deep ocean dark theme
- Analysis history stored locally with AsyncStorage (up to 50 entries)
- NT Tides: real-time tide predictions scraped from Bureau of Meteorology for Darwin, Gove & Groote Eylandt with 1-hour server-side caching
- NT Species guide: 14 NT species with bag limits, size rules, slot limits, eating ratings, best months, and season info (static data, no API needed)

**Screens (4 tabs):**
- `app/(tabs)/index.tsx` — Analyze screen (upload + AI analyze)
- `app/(tabs)/tides.tsx` — Tides screen with port selector, next tide countdown, and daily tide schedule
- `app/(tabs)/species.tsx` — Species guide with search, category filter, and expandable cards
- `app/(tabs)/history.tsx` — History of past analyses

**Data:**
- `data/ntSpecies.ts` — Static NT species regulations database (14 species)

**Components:**
- `components/SonarPulse.tsx` — Animated sonar ring pulse
- `components/AnalysisCard.tsx` — Animated fish analysis results card
- `components/HistoryItem.tsx` — History list row component

**Context:**
- `context/HistoryContext.tsx` — Persists analysis history via AsyncStorage

**Design tokens:** `constants/colors.ts` — Deep ocean navy/teal palette

### API Server (`artifacts/api-server`)

Express 5 API server.

**Routes:**
- `GET /api/healthz` — Health check
- `POST /api/analyze` — Analyze sonar image (accepts `{ imageBase64: string }`, returns fish analysis JSON)
- `GET /api/tides?port=darwin&days=3` — NT tide predictions scraped from BOM (1-hour in-memory cache). Ports: `darwin`, `gove`, `groote`
- `GET /api/tides/ports` — List available NT ports

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
