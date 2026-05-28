#!/usr/bin/env node

const apps = [
  { name: "HookVision WA", port: 25351 },
  { name: "HookVision NQ", port: 25352 },
  { name: "HookVision NT", port: 25353 },
  { name: "CrocGuard", port: 25354 },
];

function getExpoGoUrlFromManifest(manifest) {
  const bundleUrl = manifest?.launchAsset?.url;
  if (!bundleUrl) {
    return null;
  }

  try {
    const parsed = new URL(bundleUrl);
    return `exp://${parsed.host}`;
  } catch {
    return null;
  }
}

async function inspectApp(app) {
  const manifestUrl = `http://127.0.0.1:${app.port}/?platform=ios`;

  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = await response.json();
    const expoGoUrl = getExpoGoUrlFromManifest(manifest);

    console.log(`${app.name}`);
    console.log(`  Local manifest: ${manifestUrl}`);
    if (expoGoUrl) {
      console.log(`  Expo Go URL:   ${expoGoUrl}`);
    } else {
      console.log("  Expo Go URL:   unavailable (manifest did not expose a bundle host)");
    }
    console.log("");
  } catch (error) {
    console.log(`${app.name}`);
    console.log(`  Status: not running on port ${app.port} (${error.message})`);
    console.log("");
  }
}

console.log("Live mobile app status");
console.log("");

for (const app of apps) {
  await inspectApp(app);
}
