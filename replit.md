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

**Background Monitor:**
- `lib/backgroundMonitor.ts` — expo-task-manager + expo-background-fetch + expo-notifications
  CROCGUARD_STATUS_CHECK task polls status in background; sends local notification + TTS on escalation
  iOS UIBackgroundModes: audio + fetch + remote-notification; Android: POST_NOTIFICATIONS + VIBRATE

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
- `GET  /api/barra-library/status` — Barra Brain stats (1,407 photos across iNat+GBIF+ALA+Wikimedia)
- `GET  /api/barra-library/contrast` — Contrast species stats (Jack 1,636 + Fingermark 468 + Threadfin 21)
- `POST /api/barra-library/expand` — Trigger full multi-source expansion (GBIF + ALA + geographic iNat)
- `POST /api/sonar-barra-check` — Stage-1 fast sonar arch check (gpt-4.1-mini, ~600ms, uses Sonar Brain few-shot)
- `GET  /api/sonar-brain/status` — Sonar Arch Brain stats (12 expert demos + community pool)
- `POST /api/sonar-brain/submit` — Submit community-confirmed barra arch sonar scan

**AI Brain Systems:**
- **Barra Brain** (`lib/barraLibrary.ts`): 1,407 barramundi photos from iNat+GBIF+ALA+Wikimedia+geographic; 3 rotating refs injected into every barra-check call; daily refresh. Sources: inat_calcarifer (440), ALA (345), inat (272), GBIF (196), niloticus (102), wikimedia (52), geo iNat (~0 yet)
- **Contrast Library** (`lib/contrastLibrary.ts`): 2,125 photos of NOT-BARRA species — Mangrove Jack (1,636), Fingermark (468), Threadfin Salmon (21) from iNaturalist. Body photos injected into sonar-barra-check prompts as cross-modal "NOT BARRA" visual references. Table: `contrast_references`.
- **Sonar Arch Brain** (`lib/sonarBrain.ts`): 12 expert-labeled sonar demo images (Lowrance/Garmin/Humminbird/Simrad) including synthetic demos 10-12 (Jack half-arch, 3×Barra, Threadfin school); 2 positive barra refs + 1-2 negative contrast refs injected into every sonar analysis; community pool grows via `/api/sonar-brain/submit`

**DB Tables:**
- `barra_references` — barramundi photo references (iNat, GBIF, ALA, Wikimedia, community)
- `sonar_references` — community-confirmed barramundi arch sonar scans
- `contrast_references` — contrast species photos (Mangrove Jack, Fingermark, Threadfin Salmon) for species discrimination

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

## EAS Published Updates

All 3 HookVision apps are registered on expo.dev under account **hookvision** (putterfacedarwin@gmail.com).
EAS Token is stored in the `EXPO_TOKEN` Replit Secret.

| App | EAS Project | EAS Update Dashboard |
|-----|-------------|----------------------|
| HookVision WA | ce1458b7-aa80-4d0a-a752-d436c9f8db4f | https://expo.dev/accounts/hookvision/projects/hookvision |
| HookVision NQ | abdc9511-af23-4c7e-9f21-8ad3067ab9ef | https://expo.dev/accounts/hookvision/projects/hookvision-nq |
| HookVision NT | c5eb71d4-1318-4b86-86b4-a758e86c0388 | https://expo.dev/accounts/hookvision/projects/hookvision-nt |

To republish updates: `cd artifacts/hookvision && EXPO_TOKEN=$EXPO_TOKEN npx eas-cli@latest update --channel main --auto`

> Note: EAS Update publishes OTA JS bundles. To create installable APKs, run `eas build --profile preview --platform android`.

## HUD Brain System (`/hud`)

The smart-glass HUD at `/hud` is a comprehensive rotating brain panel display for anglers.

### Architecture
- **Server-side brain loop** (every 20s): fetches BOM live tides (region-aware: wa→broome, nt→darwin, nq→karumba) + community insights DB → compiles GPT-4.1-mini predictive target → broadcasts via SSE
- **POST /api/hud/update**: apps push scan results; triggers immediate brain recompile (300ms)
- **GET /api/hud/data**: returns full `BrainHudState` (scan + brain + tide + community + env)
- **GET /api/hud/events**: SSE stream of `BrainHudState`
- **POST /api/hud/brain**: manual brain trigger

### 8 Rotating Panels (20s each)
| Panel | Name | Accent | Content |
|-------|------|--------|---------|
| 0 | SONAR SCAN | teal | Species, confidence bar, fish/depth/arches/barra% metrics, AI suggestion |
| 1 | BARRA PROFILE | gold | Barra% match, arch shape, trophy indicators, water temp + bottom |
| 2 | ENVIRONMENT | blue | BOM live tide phase + next tide, season, moon phase, time of day, water temp |
| 3 | BIRDS & BAIT | cyan | Bird activity tags, bait school indicator, water clarity, sonar mode |
| 4 | CROC & SAFETY | red/green | CLEAR ✅ state or 🐊 CROC ALERT with warning text |
| 5 | WATER | blue | Clarity, temp, bottom type, sonar mode, lure used |
| 6 | COMMUNITY BRAIN | cyan | Top species bar chart, latest community tip, report count |
| 7 | AI TARGET | gold | Compiled AI prediction: species, urgency badge, confidence bar, depth, lure, cast zone, technique, full reasoning |

### HudData fields sent by apps
All 3 apps send: species, fishCount, depth, confidence, suggestion, lure, archCount, barraPct, waterTemp, bottomType, crocAlert, crocWarning, birdAlert, region (wa/nt/nq), source (boat)

Optional new fields (can be added later): birdActivity, baitSchool, waterClarity, archShape, sonarMode

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
