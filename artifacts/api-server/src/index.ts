import app from "./app";
import { logger } from "./lib/logger";
import { refreshDailyConditions } from "./lib/dailyBriefing";
import { loadDemoReferences } from "./lib/demoReference";
import { initBarraLibrary, refreshBarraLibrary } from "./lib/barraLibrary";
import { initSonarBrain } from "./lib/sonarBrain";
import { initCrocLibrary, refreshCrocLibrary } from "./lib/crocLibrary";
import { initBirdLibrary, refreshBirdLibrary } from "./lib/birdLibrary";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

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

  // Initialise the barra reference library:
  // fetches research-grade iNaturalist photos → stores in DB → caches in memory.
  // Subsequent barra-check calls inject 3 reference photos for few-shot prompting.
  initBarraLibrary().catch((err) =>
    logger.warn({ err }, "Barra library init failed — detection will use text-only prompt")
  );

  // Initialise the croc reference library:
  // fetches up to 1,000 research-grade iNaturalist photos (Crocodylus porosus +
  // Crocodylus johnstoni) → stores in DB → caches top 20 as compressed thumbnails.
  // Injected into sonar analysis and Insta360 croc-vision pipeline (Pipeline 2)
  // as few-shot cross-modal shape references.
  initCrocLibrary().catch((err) =>
    logger.warn({ err }, "Croc library init failed — croc detection will use text-only prompt")
  );

  // Initialise the bird reference library:
  // fetches up to 500 research-grade iNaturalist photos across 10 WA/Kimberley water bird
  // species (frigatebirds, terns, boobies, pelicans, osprey, brahminy kite, etc.)
  // → stores in DB → classifies poses (diving/aerial/perched/water) → caches
  // top 30 thumbnails. Injected into Insta360 surface-detect pipeline (Pipeline 1)
  // as few-shot visual references so the model can ID species in real-world frames.
  initBirdLibrary().catch((err) =>
    logger.warn({ err }, "Bird library init failed — surface detection will use text-only prompt")
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
});
