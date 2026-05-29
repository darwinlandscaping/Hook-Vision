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

  // ── Phase 1: Immediate (server is ready for requests NOW) ─────────────────
  // Model auto-detect and daily conditions are lightweight — run immediately.
  initModels().catch((err) =>
    logger.warn({ err }, "Model auto-select failed — using hardcoded fallbacks")
  );

  // Periodic model refresh every 6 hours
  setInterval(() => {
    initModels().catch(() => {});
  }, 6 * 60 * 60 * 1000);

  refreshDailyConditions().catch((err) =>
    logger.error({ err }, "Initial daily conditions refresh failed")
  );

  seedBrainKnowledge().catch((err) =>
    logger.warn({ err }, "Brain knowledge seed failed — brain will rely on user-submitted data only")
  );

  try {
    initCrocguardDb();
  } catch (err) {
    logger.warn({ err }, "CrocGuard DB init failed — detection API will be limited");
  }

  // ── Phase 2: 10s after boot — demo refs + sonar brain (local assets only) ──
  setTimeout(() => {
    loadDemoReferences()
      .catch((err) => logger.warn({ err }, "Demo reference load/compress failed"))
      .then(() =>
        initSonarBrain().catch((err) =>
          logger.warn({ err }, "Sonar brain init failed — analysis will use text-only prompt")
        )
      );
    initContrastLibrary().catch((err) =>
      logger.warn({ err }, "Contrast library init failed")
    );
    initCrocguardDetector().catch((err) =>
      logger.warn({ err }, "CrocGuard detector start failed")
    );
  }, 10_000);

  // ── Phase 3: 90s after boot — heavy network inits (iNaturalist downloads) ──
  // Staggered aggressively so the server stays responsive for user requests.
  setTimeout(() => {
    logger.info("[startup] Phase 3: starting barra library init");
    initBarraLibrary()
      .then(() =>
        collectWikimediaLates().catch((err) =>
          logger.warn({ err }, "Wikimedia Lates collection failed — iNat photos still active")
        )
      )
      .catch((err) =>
        logger.warn({ err }, "Barra library init failed — detection will use text-only prompt")
      );
  }, 90_000);

  setTimeout(() => {
    logger.info("[startup] Phase 3: starting croc library init");
    initCrocLibrary().catch((err) =>
      logger.warn({ err }, "Croc library init failed — croc detection will use text-only prompt")
    );
  }, 3 * 60 * 1000);

  setTimeout(() => {
    logger.info("[startup] Phase 3: starting bird library init");
    initBirdLibrary().catch((err) =>
      logger.warn({ err }, "Bird library init failed — surface detection will use text-only prompt")
    );
  }, 5 * 60 * 1000);

  setTimeout(() => {
    logger.info("[startup] Phase 3: starting contrast species sync");
    syncContrastSpecies().catch((err) =>
      logger.warn({ err }, "Contrast species deferred sync failed")
    );
  }, 10 * 60 * 1000);

  // Daily library refresh — 6 hours after boot, then every 24 hours
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
});
