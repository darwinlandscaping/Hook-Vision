import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import crocguardRouter from "./routes/crocguard";
import { logger } from "./lib/logger";

const app: Express = express();

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
