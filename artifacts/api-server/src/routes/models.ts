/**
 * GET /api/models
 * Returns the AI models currently active on this server plus the full list
 * of available chat models discovered from the OpenAI API.
 * Apps use this to display the live model name and refresh automatically
 * when the server upgrades to a newer model.
 */
import { Router } from "express";
import { modelsStatus } from "../lib/models.js";

const router = Router();

router.get("/models", (_req, res) => {
  res.json({ ok: true, ...modelsStatus() });
});

export default router;
