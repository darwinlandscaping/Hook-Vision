/**
 * CrocGuard integration tests — run with: npx ts-node --esm src/lib/crocguardIntegration.test.ts
 * Tests status fusion transitions, sonar ingestion, alert persistence, and resolve flow.
 * Uses in-memory state only (no HTTP server required).
 */

import { initCrocguardDb, ingestSonar, createAlert, listAlerts, resolveAlert } from "./crocguardDb.js";
import {
  getStatus, pushVisualScore, notifySonarUpdate, startDecayTick,
} from "./crocguardStatus.js";

let pass = 0;
let fail = 0;

function assert(desc: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${desc}`); pass++; }
  else       { console.error(`  ✗ ${desc}`); fail++; }
}

// Use an in-memory DB for tests
process.env["CROCGUARD_DB_PATH"] = ":memory:";
initCrocguardDb();

console.log("\n── Status fusion ──────────────────────────────────────────────────");

// 1. Initial state is green
assert("initial status is green", getStatus().status === "green");
assert("initial confidence is 0", getStatus().confidence === 0);

// 2. Sonar movement alone → orange
ingestSonar("u1", "Test Sensor", 70, true);
notifySonarUpdate();
assert("sonar movement → orange", getStatus().status === "orange");
assert("orange confidence is capped at 65", getStatus().confidence === 65);

// 3. Visual confidence < 30 with sonar → still red if > 0 + sonar
pushVisualScore(1, 15); // low visual
assert("low visual + sonar → still orange (not red; visual 15 < threshold)", getStatus().status === "orange");

// 4. High visual (>70) → red regardless of sonar
pushVisualScore(1, 85);
assert("visual > 70 → red", getStatus().status === "red");
assert("red confidence matches visual", getStatus().confidence === 85);

// 5. Low visual frame should NOT downgrade red (decay-only)
pushVisualScore(1, 5);
assert("low visual does NOT immediately downgrade red", getStatus().status === "red");

// 6. Clear sonar movement, push moderate visual; red should still hold
ingestSonar("u1", "Test Sensor", 10, false);
notifySonarUpdate();
assert("clearing sonar does NOT immediately drop red", getStatus().status === "red");

console.log("\n── Alert persistence ──────────────────────────────────────────────");

// 7. Alerts were created for transitions above
const { alerts, total } = listAlerts(1, 50);
const severities = alerts.map(a => a.severity);
assert("alerts table has entries", total > 0);
assert("orange severity recorded", severities.includes("orange"));
assert("red severity recorded", severities.includes("red"));
assert("resolved field is 0/1 integer", typeof alerts[0]!.resolved === "number");

// 8. Resolve alert
const firstId = alerts[alerts.length - 1]!.id;
const resolved = resolveAlert(firstId);
assert("resolveAlert returns row", resolved !== null);
assert("resolved flag is 1", resolved?.resolved === 1);
assert("resolved_at is set", resolved?.resolved_at != null);

// 9. createAlert for green (all transition types accepted)
const greenAlert = createAlert("system", "green", 0, undefined, { prev: "orange" });
assert("green alert created", greenAlert.severity === "green");

console.log(`\n── Results: ${pass} passed, ${fail} failed ──────────────────────────`);
if (fail > 0) process.exit(1);
