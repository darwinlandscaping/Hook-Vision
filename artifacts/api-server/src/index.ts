import app from "./app";
import { logger } from "./lib/logger";

// ── Safety net — prevent stray unhandled rejections from killing the process ──
// Any async operation that lacks a .catch() (e.g. a bad OpenAI image URL that
// fires after a request handler has already returned) would otherwise crash the
// server instantly. Log the error and continue serving.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "[server] unhandledRejection caught — server continues");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[server] uncaughtException caught — server continues");
});
import { initModels } from "./lib/models";
import { refreshDailyConditions } from "./lib/dailyBriefing";
import { loadDemoReferences } from "./lib/demoReference";
import { initBarraLibrary, refreshBarraLibrary, collectWikimediaLates } from "./lib/barraLibrary";
import { initContrastLibrary, syncContrastSpecies } from "./lib/contrastLibrary";
import { initSonarBrain } from "./lib/sonarBrain";
import { initCrocLibrary, refreshCrocLibrary } from "./lib/crocLibrary";
import { initBirdLibrary, refreshBirdLibrary } from "./lib/birdLibrary";
import { initCrocguardDb } from "./lib/crocguardDb";
import { initCrocguardDetector } from "./lib/crocguardDetector";
import { seedBrainKnowledge } from "./lib/brainSeed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep connections alive longer than Replit's reverse-proxy 60 s window.
  // Without this, Node's default 5 s keepAliveTimeout causes the proxy to
  // see the connection close mid-flight and reset it to the phone as a 502.
  server.keepAliveTimeout = 65_000;   // ms — must exceed proxy keep-alive (60 s)
  server.headersTimeout   = 70_000;   // ms — slightly longer than keepAlive

  // TCP keepalive probes on every accepted socket.
  // Causes the OS to probe idle connections every 30 s, so a Starlink dropout
  // that silently kills a TCP connection is detected in ~90 s instead of the
  // OS default of 2 hours — prevents zombie connections stacking up.
  server.on("connection", (socket) => {
    socket.setKeepAlive(true, 30_000);
  });

  // Auto-detect the best available OpenAI models for each tier (top/mid/fast).
  // Refreshes every 6 hours so new model releases are picked up automatically.
  initModels().catch((err) =>
    logger.warn({ err }, "Model auto-select failed — using hardcoded fallbacks")
  );

  // Load + compress demo reference images (now async — thumbnails built at startup).
  // Chain sonar brain init AFTER so it can use the compressed thumbnails.
  loadDemoReferences()
    .catch((err) => logger.warn({ err }, "Demo reference load/compress failed"))
    .then(() =>
      initSonarBrain().catch((err) =>
        logger.warn({ err }, "Sonar brain init failed — analysis will use text-only prompt")
      )
    );

  // Kick off the daily data refresh immediately on startup,
  // then it auto-schedules itself at midnight WA time (AWST UTC+8:00).
  refreshDailyConditions().catch((err) =>
    logger.error({ err }, "Initial daily conditions refresh failed")
  );

  // Initialise the Lates reference library:
  // Fetches ALL available Lates calcarifer (barramundi/Asian sea bass, ~700 globally) +
  // Lates niloticus (Nile perch, ~100 globally) from iNaturalist — all quality grades,
  // no region restriction. After iNat sync completes, Wikimedia Commons collection runs
  // as a chained background job (adds curated CC-licensed photos for both species).
  initBarraLibrary()
    .then(() =>
      collectWikimediaLates().catch((err) =>
        logger.warn({ err }, "Wikimedia Lates collection failed — iNat photos still active")
      )
    )
    .catch((err) =>
      logger.warn({ err }, "Barra library init failed — detection will use text-only prompt")
    );

  // Initialise contrast species library (Jack, Threadfin Salmon, Fingermark).
  // On startup: load from DB into memory cache only (fast, no network).
  // Full iNaturalist sync deferred to 8 minutes after boot so it doesn't
  // compete with barra/croc/bird inits for memory.
  initContrastLibrary()
    .catch((err) =>
      logger.warn({ err }, "Contrast library init failed")
    );
  setTimeout(() => {
    syncContrastSpecies().catch((err) =>
      logger.warn({ err }, "Contrast species deferred sync failed")
    );
  }, 8 * 60 * 1000);  // 8 minutes after boot

  // Croc + bird libraries are staggered so they don't compete with the barra init
  // for memory at startup (all loading 80 refs + downloading thumbnails sequentially).
  // Croc: 2 minutes after boot. Bird: 4 minutes after boot.
  setTimeout(() => {
    initCrocLibrary().catch((err) =>
      logger.warn({ err }, "Croc library init failed — croc detection will use text-only prompt")
    );
  }, 2 * 60 * 1000);

  setTimeout(() => {
    initBirdLibrary().catch((err) =>
      logger.warn({ err }, "Bird library init failed — surface detection will use text-only prompt")
    );
  }, 4 * 60 * 1000);

  // Seed brain with expert regional fishing knowledge (WA/NQ/NT).
  // Idempotent — checks for seed marker before inserting, so safe to call on every boot.
  seedBrainKnowledge().catch((err) =>
    logger.warn({ err }, "Brain knowledge seed failed — brain will rely on user-submitted data only")
  );

  // Daily library refresh — runs 6 hours after boot (offset from daily conditions)
  setTimeout(() => {
    refreshBarraLibrary().catch(() => {});
    refreshCrocLibrary().catch(() => {});
    refreshBirdLibrary().catch(() => {});
    setInterval(() => {
      refreshBarraLibrary().catch(() => {});
      refreshCrocLibrary().catch(() => {});
      refreshBirdLibrary().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, 6 * 60 * 60 * 1000);

  // Initialise CrocGuard detection API:
  // Creates SQLite DB + tables, hydrates in-memory caches, starts camera
  // sampling loop and sonar status fusion engine.
  try {
    initCrocguardDb();
    initCrocguardDetector().catch((err) =>
      logger.warn({ err }, "CrocGuard detector start failed")
    );
  } catch (err) {
    logger.warn({ err }, "CrocGuard init failed — detection API will be limited");
  }
});
