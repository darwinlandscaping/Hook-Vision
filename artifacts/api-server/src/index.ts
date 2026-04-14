import app from "./app";
import { logger } from "./lib/logger";
import { refreshDailyConditions } from "./lib/dailyBriefing";
import { loadDemoReferences } from "./lib/demoReference";
import { initBarraLibrary, refreshBarraLibrary } from "./lib/barraLibrary";

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

  // Load demo reference images for AI visual comparison (fish ID accuracy boost)
  loadDemoReferences();

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

  // Daily library refresh — runs 6 hours after boot (offset from daily conditions)
  setTimeout(() => {
    refreshBarraLibrary().catch(() => {});
    setInterval(() => refreshBarraLibrary().catch(() => {}), 24 * 60 * 60 * 1000);
  }, 6 * 60 * 60 * 1000);
});
