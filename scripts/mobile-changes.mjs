#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const mobilePrefixes = [
  "artifacts/hookvision/",
  "artifacts/hookvision-nq/",
  "artifacts/hookvision-nt/",
  "artifacts/crocguard/",
  "artifacts/hookvision-web/",
  "lib/",
  "packages/",
  "scripts/",
  ".replit",
  "AGENTS.md",
  "replit.md",
  "package.json",
  "pnpm-lock.yaml",
];

function runGit(args) {
  return execFileSync("git", args, {
    cwd: "/workspace",
    encoding: "utf8",
  }).trim();
}

function getBaseRef() {
  const candidates = ["origin/main", "main"];

  for (const candidate of candidates) {
    try {
      runGit(["rev-parse", "--verify", candidate]);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Could not find main or origin/main to diff against.");
}

function listLines(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isMobileRelevant(filePath) {
  return mobilePrefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
}

const baseRef = getBaseRef();
const mergeBase = runGit(["merge-base", "HEAD", baseRef]);
const branchName = runGit(["branch", "--show-current"]);

const branchFiles = listLines(runGit(["diff", "--name-only", `${mergeBase}..HEAD`])).filter(isMobileRelevant);
const workingTreeFiles = listLines(runGit(["status", "--short"])).map((line) => line.slice(3)).filter(isMobileRelevant);

console.log(`Mobile changes for branch: ${branchName || "(detached HEAD)"}`);
console.log(`Compared against: ${baseRef}`);
console.log("");

if (branchFiles.length === 0) {
  console.log("No committed mobile-relevant file changes were found on this branch.");
} else {
  console.log("Committed mobile-relevant changes on this branch:");
  for (const filePath of branchFiles) {
    console.log(`- ${filePath}`);
  }
}

console.log("");

if (workingTreeFiles.length === 0) {
  console.log("No uncommitted mobile-relevant changes in the working tree.");
} else {
  console.log("Uncommitted mobile-relevant changes:");
  for (const filePath of workingTreeFiles) {
    console.log(`- ${filePath}`);
  }
}
