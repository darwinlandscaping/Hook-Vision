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

### HookVision NT (`artifacts/hookvision-nt`)

NT Australia Edition of HookVision — Expo + React Native targeting Northern Territory.

- app.json: name "HookVision NT", slug "hookvision-nt", scheme "hookvision-nt", package "com.hookvision.nt"
- Port 25353, baseUrl /hookvision-nt, Darwin time (UTC+9:30) for golden hour + clock
- `darwin` variable in home.tsx uses `getDarwinTime()` (UTC+9:30 — correct for NT)
- Weather source line uses `darwin.timeStr` (local Darwin time) since API returns waLocalTime (WA time)
- NT LIVE WEATHER section heading (not "DARWIN LIVE WEATHER")
- NT species guide, NT regulations, NT tides (Darwin BOM primary ports)
- DailyConditions interface uses `waLocalTime: string` (API field name from WA/Broome BOM)

### HookVision WA (`artifacts/hookvision`)

A polished WA/Kimberley fishing mobile app built with Expo + React Native targeting the Kimberley region.

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

### HookVision NQ (`artifacts/hookvision-nq`)

North Queensland / Gulf Country Edition of HookVision — a complete standalone Expo + React Native app.

**Key Differences from NT Edition:**
- Welcome screen: Great Barrier Reef aerial photo + Queensland flag + "ENTER THE GULF" button
- Queensland Fisheries bag/size limits (barra 5-fish 58cm; coral trout 8-fish 38cm; Spanish mack 5-fish 75cm, etc.)
- NQ tide locations: Karumba, Norman River, Mitchell River, Weipa, Cairns, Cooktown, Burketown, Port Douglas
- BOM ports: QLD_TP001 (Karumba), QLD_TP002 (Weipa), QLD_TP003 (Cairns), QLD_TP004 (Cooktown)
- Brisbane time (AEST UTC+10) throughout — not Darwin UTC+9:30
- NQ/Gulf Country river systems: Norman, Mitchell, Gilbert, Flinders, Embley (Weipa), Albert, Endeavour, Wenlock
- NQ GPS hotspots: 35 NQ/Gulf Country fishing spots
- No Million Dollar Fish — replaced with Karumba Barra Classic, Weipa GT & Barra Tournament, Cairns Offshore Classic, Burketown Barra Classic
- NQ barra hotspots: Karumba Point, Norman River Cut Bank, Mitchell River Mouth, Weipa Causeway, Albert River, etc.
- NQ species: Sooty Grunter, Golden Snapper (Fingermark), Coral Trout replacing NT-only species
- All "Top End"/"NT Fisheries" terminology replaced with NQ/QLD equivalents
- Package: `@workspace/hookvision-nq`; port 25352; scheme `hookvision-nq`; android package `com.hookvision.nq`
- `qldTime` variable in home.tsx uses `getQldTime()` (AEST UTC+10 — correct for QLD)
- Weather source line uses `qldTime.timeStr` (local Brisbane time) since API returns waLocalTime (WA time)
- DailyConditions interface uses `waLocalTime: string` (API field name — the field is WA-named but only used for cache-busting, display uses local computed time)

### CrocGuard (`artifacts/crocguard`)

Standalone crocodile safety monitor phone app — Expo + React Native, dark green theme, minimal 4-tab design for at-a-glance danger status.

- Port 3001, baseUrl /crocguard
- Package: `@workspace/crocguard`; scheme `crocguard`; android package `com.hookvision.crocguard`
- Workflow: `artifacts/crocguard: expo` (PORT=3001)

**Screens (4 tabs):**
- `app/(tabs)/index.tsx` — Full-screen traffic light status (green/orange/red) polling `/api/crocguard/status` every 2s; keep-awake; pulsing animation for danger states
- `app/(tabs)/cameras.tsx` — Camera list from `/api/crocguard/cameras`; WebView MJPEG stream modal (native)
- `app/(tabs)/alerts.tsx` — Detection log from `/api/crocguard/alerts`; 5s poll; severity-colour-coded rows
- `app/(tabs)/settings.tsx` — AsyncStorage-persisted API URL + audio toggle

**Hooks:**
- `hooks/useCrocGuardStatus.ts` — 2s polling hook; tracks prevStatus for escalation detection
- `hooks/useAudioAlert.ts` — Escalating alerts: Orange = short beep + vibration; Red = siren + vibration

**Context:**
- `contexts/SettingsContext.tsx` — AsyncStorage-backed apiBaseUrl + audioEnabled; defaults to REPLIT_DEV_DOMAIN

**Design tokens:** dark forest (#0d1f0f) / green (#22c55e) / orange (#f97316) / red (#ef4444)

### API Server (`artifacts/api-server`)

Express 5 API server.

**Routes:**
- `GET  /api/healthz` — Health check
- `POST /api/analyze` — Analyze sonar image (accepts `{ imageBase64: string }`, returns fish analysis JSON) — GPT-4 vision
- `GET  /api/tides?port=darwin&days=3` — NT/NQ tide predictions from BOM (1-hour cache). NT ports: darwin, gove, groote. NQ ports: karumba, weipa, cairns, cooktown. Also supports `?location=ID` for 60+ secondary locations with BOM secondary port corrections
- `GET  /api/tides/locations` — List all secondary tide locations (NT + NQ combined)
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

## Critical pnpm-store Patches (MUST survive reinstalls — re-apply if lost)

The Replit proxy strips path prefixes before forwarding to Metro, so three Expo Router
internals needed patching to make all three editions work simultaneously:

### 1. `fork/getPathFromState.js` — the REAL `appendBaseUrl`
Path: `node_modules/.pnpm/expo-router@6.0.23_.../node_modules/expo-router/build/fork/getPathFromState.js`
Change line ~330: `if (process.env.NODE_ENV !== 'development') {` → `if (true) { // PATCHED`
Reason: this is the function actually called by `useLinking.js`; without the patch,
`appendBaseUrl` is a no-op in dev and the router navigates to bare `/` instead of `/hookvision-nq/`.

### 2. `fork/getPathFromState-forks.js` + `fork/getStateFromPath-forks.js`
Same `NODE_ENV` guard pattern — also patched to `if (true)`.

### 4. `fork/getStateFromPath-forks.js` — `matchForEmptyPath` index fallback
Added `leafNodes.find((config) => config.isIndex && !config.regex)` as a secondary
match in `matchForEmptyPath` (after the primary `path === ''` check). Without this,
NQ and NT's root `app/index.tsx` route occasionally fails to match when the Replit
proxy baseUrl is active, causing the router to fall through to `+not-found`.

### 5. `app/+not-found.tsx` (NQ + NT) — auto-redirect
Both NQ and NT `+not-found.tsx` redirect to `/(tabs)/home` in 50ms on web as a
bulletproof fallback for any remaining routing edge cases via the Replit proxy.

### 3. Metro `HmrServer.js`
Path: `node_modules/.pnpm/metro@0.83.3/.../metro/src/HmrServer.js`
Wrapped `this._registerEntryPoint(...)` with `.catch(() => {})` at line ~196.
Reason: NQ/NT browsers connect HMR websocket to the bare proxy (no path prefix), which
routes to WA Metro; WA would crash trying to resolve a foreign entry point.

### Per-artifact config requirements
Each edition needs three things aligned in its `metro.config.js` + `app.json`:
- `metro.config.js`: `rewriteRequestUrl` (converts `/` → `/<BASE>/`) + `enhanceMiddleware`
  (prepends `/<BASE>` to asset src/href, changes `lazy=true` → `lazy=false`)
- `app.json`: `experiments.baseUrl = "/<BASE>"` so Metro injects `transform.baseUrl` into HTML

| Edition   | BASE          | Port  |
|-----------|---------------|-------|
| WA        | /hookvision   | $PORT |
| NQ        | /hookvision-nq| 25352 |
| NT        | /hookvision-nt| 25353 |
| CrocGuard | /crocguard    | 3001  |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
