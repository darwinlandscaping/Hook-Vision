import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Ultra-light connectivity probe — no JSON schema, no DB, just 200 immediately.
// Used by mobile clients to detect network drop-out before starting a cycle.
router.get("/ping", (_req, res) => {
  res.set("Cache-Control", "no-store").status(200).send("ok");
});

export default router;
