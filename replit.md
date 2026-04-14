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

A polished NT fishing mobile app built with Expo + React Native targeting NT Australia.

**Features:**
- AI sonar analysis via GPT-4 vision (fish count, depth, species, lure advice) — 5 NT priority species: Barra → Fingermark → Rock Cod → Mangrove Jack → Thready
- Live Camera tab with sonar bracket mount mode (auto-scan every 12s) and real-time character-voice narration
- NT Tides from BOM (Darwin NT_TP001, UTC+9:30) with next tide countdown and multi-day schedule
- NT Species guide: 14+ species, bag/size/slot limits, eating ratings, seasons, searchable
- Here Fishy Fishy forecast page: moon phase, BOM tides, season, water temp → AI spot picks + boat ramps + NT road closure links
- Depth Strike Zones: 7 NT river systems with curated depth zones + 80s commercial netting records
- Trophy Barra Predictor: pulsing red button → GPT-4.1 depth predictions with 40-year river knowledge
- Analysis history (AsyncStorage, up to 50 entries)

**AI Voice Narrator System:**
- 4 narrator characters: NT Fishing Guide (AUSSIE), Richie Benaud, Chopper Read, David Attenborough
- 11 languages: en-AU, ja-JP, zh-CN, id-ID, de-DE, fr-FR, es-ES, ko-KR, th-TH, vi-VN, pt-BR
- Character/language persisted via AsyncStorage
- Voice rate/pitch tuned per character (Attenborough slowest, Chopper fastest)
- `/api/narrate` endpoint generates character-styled narration text via GPT-4.1-mini
- expo-speech plays the result in device's native TTS

**Screens (8 tabs):**
- `app/(tabs)/index.tsx` — Analyze screen (upload + AI analyze, with history integration)
- `app/(tabs)/live.tsx` — Live camera with bracket mount auto-scan mode + narrator
- `app/(tabs)/tides.tsx` — NT tides from BOM with port selector
- `app/(tabs)/species.tsx` — NT species guide with search/filter
- `app/(tabs)/barra.tsx` — Trophy Barra Predictor (red button, GPT-4.1, depth predictions)
- `app/(tabs)/zones.tsx` — Depth Strike Zones (7 NT rivers + 80s netting records)
- `app/(tabs)/forecast.tsx` — Here Fishy Fishy (conditions + AI spot guide + boat ramps + roads)
- `app/(tabs)/history.tsx` — Past analysis history

**Components:**
- `components/SonarPulse.tsx` — Animated sonar ring pulse
- `components/AnalysisCard.tsx` — Animated fish analysis results card
- `components/HistoryItem.tsx` — History list row component
- `components/NarratorButton.tsx` — Reusable narrator speak/stop button (full + compact variants)
- `components/NarratorSettings.tsx` — Character + language picker modal; NarratorSettingsTrigger header button

**Context:**
- `context/HistoryContext.tsx` — Persists analysis history via AsyncStorage
- `context/NarratorContext.tsx` — Narrator character/language state, speak(), narratePage() — wraps full app in _layout.tsx

**Data:**
- `data/ntSpecies.ts` — Static NT species regulations database (14+ species)
- `data/depthZones.ts` — 7 NT river systems with depth zones + 80s netting history

**Design tokens:** `constants/colors.ts` — Deep ocean navy (#0a1628) / teal (#00d4aa) / blue (#00a8ff) / gold (#ffd700); Trophy Barra red (#ff2200)

### API Server (`artifacts/api-server`)

Express 5 API server.

**Routes:**
- `GET  /api/healthz` — Health check
- `POST /api/analyze` — Analyze sonar image (accepts `{ imageBase64: string }`, returns fish analysis JSON) — GPT-4 vision
- `GET  /api/tides?port=darwin&days=3` — NT tide predictions from BOM (1-hour cache). Ports: darwin, gove, groote
- `GET  /api/tides/ports` — List available NT ports
- `GET  /api/forecast?lat=&lon=` — Here Fishy Fishy conditions → AI spot picks (GPT-4.1)
- `POST /api/barra` — Trophy Barra depth predictions (GPT-4.1, 3 ranked predictions)
- `POST /api/narrate` — Character-voiced narration text (GPT-4.1-mini, 4 characters × 11 languages)
- `POST /api/fish-id` — Full species ID from fish photo (GPT-4.1)
- `POST /api/barra-check` — Stage-1 fast barra photo check (GPT-4.1-mini, ~400ms, uses Barra Brain few-shot)
- `GET  /api/barra-library/status` — Barra Brain stats (iNaturalist references, 267 photos)
- `POST /api/sonar-barra-check` — Stage-1 fast sonar arch check (gpt-4.1-mini, ~600ms, uses Sonar Brain few-shot)
- `GET  /api/sonar-brain/status` — Sonar Arch Brain stats (5 expert demos + community pool)
- `POST /api/sonar-brain/submit` — Submit community-confirmed barra arch sonar scan

**AI Brain Systems:**
- **Barra Brain** (`lib/barraLibrary.ts`): 267 iNaturalist research-grade barramundi photos; 3 rotating refs injected into every barra-check call; daily refresh
- **Sonar Arch Brain** (`lib/sonarBrain.ts`): 5 expert-labeled sonar demo images (Lowrance/Garmin/Humminbird/Simrad); 2 positive barra refs + 1 negative contrast ref injected into every sonar analysis + sonar-barra-check call; community pool grows via `/api/sonar-brain/submit`

**DB Tables:**
- `barra_references` — iNaturalist barramundi photo references
- `sonar_references` — community-confirmed barramundi arch sonar scans

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
