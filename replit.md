# HookVision Monorepo
A monorepo for fishing mobile applications, AI backend, and a crocodile safety monitor.

## Run & Operate

- `pnpm run typecheck`: Type-check all packages.
- `pnpm run build`: Type-check and build all packages.
- `pnpm --filter @workspace/api-spec run codegen`: Regenerate API hooks and Zod schemas from OpenAPI spec.
- `pnpm --filter @workspace/db run push`: Push DB schema changes (development only).
- `pnpm --filter @workspace/api-server run dev`: Run the API server locally.
- `pnpm --filter @workspace/hookvision run dev`: Start HookVision WA in Replit mode when Replit env vars exist, otherwise fall back to Expo tunnel mode for Expo Go.
- `pnpm --filter @workspace/hookvision-nq run dev`: Start HookVision NQ with the same Replit-or-tunnel behavior.
- `pnpm --filter @workspace/hookvision-nt run dev`: Start HookVision NT with the same Replit-or-tunnel behavior.
- `pnpm --filter @workspace/crocguard run dev`: Start CrocGuard in Replit mode or Expo tunnel mode for phone testing.
- `pnpm mobile:preview`: Publish the current uncommitted HookVision app changes to the Expo `preview` branch.
- `pnpm mobile:preview:watch`: Watch the mobile app files and auto-publish uncommitted HookVision changes to Expo Go.

**Required Environment Variables:**
- `EXPO_TOKEN`: For EAS published updates.
- `REPLIT_DEV_DOMAIN`: Default for CrocGuard API URL.

## Mobile app preview modes

There are two different ways to see app changes on a phone:

1. **Live Expo dev server**
   - Run any app's `dev` script.
   - In Replit it uses the existing proxy workflow.
   - Outside Replit it switches to `expo start --tunnel`, so the QR code in the terminal works from Expo Go without needing a commit.

2. **Expo OTA preview**
   - Run `pnpm mobile:preview` for a one-off publish.
   - Run `pnpm mobile:preview:watch` to keep publishing uncommitted changes after edits.
   - OTA publishes use `EAS_NO_VCS=1`, so a clean git state is not required.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **Package Manager**: pnpm
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations

## Where things live

- **`artifacts/hookvision-nt`**: HookVision Northern Territory Edition (Expo/React Native app).
- **`artifacts/hookvision`**: HookVision WA/Kimberley Edition (Expo/React Native app).
- **`artifacts/hookvision-nq`**: HookVision North Queensland Edition (Expo/React Native app).
- **`artifacts/crocguard`**: CrocGuard (Expo/React Native app).
- **`artifacts/api-server`**: Express.js API server.
- **`artifacts/hud`**: Smart-glass HUD display system.
- **DB Schema**: `packages/db/schema.ts` (implied, not explicitly stated as source-of-truth but standard for Drizzle)
- **API Contracts**: OpenAPI spec used for codegen (`@workspace/api-spec`).
- **Theme Files**: `artifacts/hookvision/constants/colors.ts`, `artifacts/crocguard/constants/colors.ts` (implied)

## Architecture decisions

-   **Monorepo with pnpm workspaces**: Enables shared code and consistent dependencies across multiple distinct applications (HookVision variants, CrocGuard, API server).
-   **Region-specific app variants**: Instead of a single configurable app, separate Expo projects (`hookvision-nt`, `hookvision-nq`, `hookvision`) are maintained for distinct regional fisheries regulations, tides, and content.
-   **AI-driven features**: Centralized AI capabilities (sonar analysis, species ID, fishing forecasts, narration, barra predictions) are handled by the `api-server` using various GPT models.
-   **Client-side background tasks for CrocGuard**: Utilizes `expo-task-manager` for background polling and notifications, crucial for a safety-critical application.
-   **Pnpm-store patches for Expo Router**: Custom patches are applied to `expo-router` and `metro` internals to correctly handle base URLs and HMR in a Replit multi-app environment, ensuring all apps function simultaneously.
-   **HUD Brain System**: A dedicated server-side component (`/hud`) processes real-time data, generates AI-driven predictions, and broadcasts updates via SSE to a smart-glass display, indicating a separate, specialized display client.

## Product

- **HookVision (WA, NT, NQ Editions)**: Mobile fishing apps providing AI sonar analysis, live camera sonar narration, regional tide data, species guides, fishing forecasts, depth strike zones, and trophy barra prediction.
- **CrocGuard**: A mobile safety application that monitors crocodile danger status, displays camera feeds, and provides escalating audio/visual alerts in the background.
- **API Server**: Backend for all mobile applications, offering AI analysis, tide data, forecasts, and supporting services.
- **HUD Brain System**: A smart-glass display for anglers showing real-time fishing intelligence, including sonar data, environmental conditions, and AI-compiled targets.

## User preferences

_Populate as you build_

## Gotchas

-   **pnpm-store patches**: Crucial `expo-router` and `metro` patches must be re-applied if `node_modules` is rebuilt or reinstalled, especially in the Replit environment.
-   **Replit Proxy Behavior**: The Replit proxy strips path prefixes, requiring custom Metro configurations (`rewriteRequestUrl`, `enhanceMiddleware`) and specific `app.json` `experiments.baseUrl` settings for each Expo app.
-   **EAS Updates**: `EXPO_TOKEN` secret is required for publishing OTA updates via EAS CLI.
-   **Regional vs. WA Time**: Be mindful that external APIs might return WA local time (`waLocalTime`), but display logic often requires conversion to the specific region's local time (e.g., Darwin UTC+9:30, Brisbane UTC+10).
-   **Metro HMR**: Metro's HMR server needs a `.catch(() => {})` wrapper for `_registerEntryPoint` to prevent crashes when multiple apps are running and HMR websockets connect to the wrong Metro instance.

## Pointers

-   [pnpm-workspace skill](https://docs.pnpm.io/workspaces/overview)
-   [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
-   [Expo Documentation](https://docs.expo.dev/)
-   [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
-   [Zod Documentation](https://zod.dev/)
-   [Orval Documentation](https://orval.dev/)
-   [EAS CLI Documentation](https://docs.expo.dev/eas/build/introduction/)
-   [Replit AI Integrations](https://docs.replit.com/integrations/ai)