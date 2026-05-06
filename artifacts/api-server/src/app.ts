import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import crocguardRouter from "./routes/crocguard";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Global request timeout — 55 s hard ceiling ────────────────────────────────
// Replit's reverse-proxy times out at 60 s and returns a 502. By destroying
// the socket at 55 s we give the client a clean connection reset instead, which
// the app can catch and retry rather than showing an opaque "Server error 502".
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out — please retry" });
    }
    req.socket?.destroy();
  }, 55_000);
  res.on("finish", () => clearTimeout(timer));
  res.on("close",  () => clearTimeout(timer));
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/public", express.static(path.join(__dirname, "../public")));

app.use("/api", router);
// /api/crocguard/* — namespaced (for downstream apps)
// /crocguard/*     — alias
// /status /cameras /sonar /alerts — root-level aliases matching task spec contract
app.use("/crocguard", crocguardRouter);
app.use(crocguardRouter);

export default app;
