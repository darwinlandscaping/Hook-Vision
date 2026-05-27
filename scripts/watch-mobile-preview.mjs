#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const branch = process.env.EXPO_PREVIEW_BRANCH || "preview";
const debounceMs = Number(process.env.EXPO_PREVIEW_DEBOUNCE_MS || 12000);
const messagePrefix = process.env.EXPO_PREVIEW_MESSAGE_PREFIX || "Cursor preview sync";

const watchRoots = [
  "artifacts/hookvision",
  "artifacts/hookvision-nq",
  "artifacts/hookvision-nt",
  "lib",
  "packages",
];

const ignoredSegments = new Set([
  ".expo",
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "static-build",
]);

let publishTimer;
let publishRunning = false;
let publishQueued = false;
let changedFiles = new Set();

function shouldIgnore(relativePath) {
  const parts = relativePath.split(path.sep);
  return parts.some((part) => ignoredSegments.has(part));
}

function buildMessage() {
  const recentFiles = [...changedFiles].slice(-4).map((file) => path.basename(file));
  const suffix = recentFiles.length > 0 ? ` (${recentFiles.join(", ")})` : "";
  return `${messagePrefix}${suffix}`.slice(0, 200);
}

function queuePublish() {
  clearTimeout(publishTimer);
  publishTimer = setTimeout(runPublish, debounceMs);
}

function runPublish() {
  if (publishRunning) {
    publishQueued = true;
    return;
  }

  publishRunning = true;
  publishQueued = false;

  const message = buildMessage();
  console.log(`\nPublishing Expo preview updates to '${branch}'`);
  console.log(`Message: ${message}`);

  const child = spawn("bash", ["scripts/publish-ota.sh", message, branch], {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    publishRunning = false;
    changedFiles = new Set();

    if (code !== 0) {
      console.error(`OTA publish exited with code ${code ?? "unknown"}`);
    }

    if (publishQueued) {
      queuePublish();
    }
  });
}

for (const relativeRoot of watchRoots) {
  const absoluteRoot = path.join(workspaceRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    continue;
  }

  watch(
    absoluteRoot,
    { recursive: true },
    (_eventType, filename) => {
      if (!filename) {
        return;
      }

      const relativePath = path.join(relativeRoot, String(filename));
      if (shouldIgnore(relativePath)) {
        return;
      }

      changedFiles.add(relativePath);
      console.log(`Change detected: ${relativePath}`);
      queuePublish();
    },
  );
}

console.log("Watching mobile app files for OTA preview publishing.");
console.log(`Debounce: ${debounceMs}ms | Branch: ${branch}`);
console.log("Changes are published with EAS_NO_VCS=1, so commits are not required.");
