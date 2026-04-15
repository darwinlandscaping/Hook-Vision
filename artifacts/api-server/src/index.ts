import app from "./app";
import { logger } from "./lib/logger";
import { refreshDailyConditions } from "./lib/dailyBriefing";
import { loadDemoReferences } from "./lib/demoReference";
import { initBarraLibrary, refreshBarraLibrary } from "./lib/barraLibrary";
import { initSonarBrain } from "./lib/sonarBrain";
import { initCrocLibrary, refreshCrocLibrary } from "./lib/crocLibrary";

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
  // then it auto-schedules itself at midnight Darwin time (ACST UTC+9:30).
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
  // fetches research-grade iNaturalist Crocodylus porosus photos (target: 500)
  // → stores in DB → caches top 20 as compressed base64 thumbnails.
  // Injected into every sonar analysis as cross-modal shape references
  // so the AI can compare sonar blobs against real croc body silhouettes.
  initCrocLibrary().catch((err) =>
    logger.warn({ err }, "Croc library init failed — croc detection will use text-only prompt")
  );

  // Daily library refresh — runs 6 hours after boot (offset from daily conditions)
  setTimeout(() => {
    refreshBarraLibrary().catch(() => {});
    refreshCrocLibrary().catch(() => {});
    setInterval(() => {
      refreshBarraLibrary().catch(() => {});
      refreshCrocLibrary().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, 6 * 60 * 60 * 1000);
});
