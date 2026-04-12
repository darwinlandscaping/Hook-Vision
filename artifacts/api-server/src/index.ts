import app from "./app";
import { logger } from "./lib/logger";
import { refreshDailyConditions } from "./lib/dailyBriefing";

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

  // Kick off the daily data refresh immediately on startup,
  // then it auto-schedules itself at midnight Darwin time (ACST UTC+9:30).
  refreshDailyConditions().catch((err) =>
    logger.error({ err }, "Initial daily conditions refresh failed")
  );
});
