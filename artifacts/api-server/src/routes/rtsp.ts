/**
 * RTSP → HLS proxy
 * Spawns ffmpeg per stream, serves HLS segments, auto-cleans idle sessions.
 *
 * POST   /api/rtsp/start          { id, url } → { id, hlsPath }
 * GET    /api/rtsp/hls/:id/:file  serves .m3u8 / .ts segments
 * DELETE /api/rtsp/stop/:id       kills ffmpeg + cleans temp dir
 * GET    /api/rtsp/status         lists active sessions
 */
import { Router } from "express";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface StreamSession {
  id: string;
  url: string;
  proc: ChildProcessWithoutNullStreams;
  outDir: string;
  startedAt: number;
  lastRequest: number;
}

// ─── State ───────────────────────────────────────────────────────────────────

const sessions = new Map<string, StreamSession>();
const HLS_BASE = path.join(os.tmpdir(), "rtsp-hls");

fs.mkdirSync(HLS_BASE, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function stopSession(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  try { s.proc.kill("SIGTERM"); } catch {}
  sessions.delete(id);
  setTimeout(() => {
    try { fs.rmSync(s.outDir, { recursive: true, force: true }); } catch {}
  }, 2000);
}

// Auto-clean sessions idle for > 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastRequest > 3 * 60_000) stopSession(id);
  }
}, 30_000).unref();

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/rtsp/start
router.post("/rtsp/start", (req, res) => {
  const rawId  = (req.body as Record<string, string>)["id"]  ?? "";
  const rawUrl = (req.body as Record<string, string>)["url"] ?? "";
  const id  = safeId(rawId);
  const url = rawUrl.trim();

  if (!id) { res.status(400).json({ error: "id is required" }); return; }
  if (!/^rtsp:\/\//i.test(url)) {
    res.status(400).json({ error: "url must start with rtsp://" });
    return;
  }

  // Stop existing session with same id before restarting
  if (sessions.has(id)) stopSession(id);

  const outDir = path.join(HLS_BASE, id);
  fs.mkdirSync(outDir, { recursive: true });
  const outM3u8 = path.join(outDir, "index.m3u8");

  const proc = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-i", url,
    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
    "-vf", "scale=854:480",
    "-b:v", "800k",
    "-c:a", "aac", "-ar", "44100", "-ac", "1",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments",
    "-y",
    outM3u8,
  ]);

  proc.stderr.on("data", (chunk: Buffer) => {
    req.log.debug({ id }, `[rtsp] ffmpeg: ${chunk.toString().trim().slice(0, 120)}`);
  });

  proc.on("error", (err) => {
    req.log.error({ err, id }, "[rtsp] ffmpeg spawn error");
    sessions.delete(id);
  });

  proc.on("exit", (code) => {
    req.log.info({ id, code }, "[rtsp] ffmpeg exited");
    sessions.delete(id);
  });

  const session: StreamSession = {
    id, url, proc, outDir,
    startedAt: Date.now(),
    lastRequest: Date.now(),
  };
  sessions.set(id, session);

  req.log.info({ id, url }, "[rtsp] stream started");

  // Give ffmpeg 3 s to write first segment before responding
  setTimeout(() => {
    res.json({
      id,
      hlsPath: `/api/rtsp/hls/${id}/index.m3u8`,
    });
  }, 3000);
});

// GET /api/rtsp/hls/:id/:file
router.get("/rtsp/hls/:id/:file", (req, res) => {
  const id   = safeId(req.params["id"]   ?? "");
  const file = path.basename(req.params["file"] ?? "");

  const s = sessions.get(id);
  if (!s) {
    res.status(404).json({ error: "stream not found or expired — restart it" });
    return;
  }
  s.lastRequest = Date.now();

  const filePath = path.join(s.outDir, file);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("segment not ready yet");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  if (ext === ".m3u8") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store, no-cache");
  } else {
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Cache-Control", "max-age=60");
  }

  res.sendFile(filePath);
});

// DELETE /api/rtsp/stop/:id
router.delete("/rtsp/stop/:id", (req, res) => {
  const id = safeId(req.params["id"] ?? "");
  stopSession(id);
  req.log.info({ id }, "[rtsp] stream stopped by client");
  res.json({ ok: true });
});

// GET /api/rtsp/status
router.get("/rtsp/status", (_req, res) => {
  const active = [...sessions.values()].map((s) => ({
    id: s.id,
    url: s.url,
    uptimeSecs: Math.round((Date.now() - s.startedAt) / 1000),
    idleSecs: Math.round((Date.now() - s.lastRequest) / 1000),
  }));
  res.json({ active, count: active.length });
});

export default router;
