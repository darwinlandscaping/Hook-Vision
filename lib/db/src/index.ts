import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Prevent unhandled 'error' events on idle pool clients from crashing the process.
// pg emits these when the DB terminates a connection (maintenance, idle timeout,
// administrator command). Without this listener Node.js treats it as an uncaught
// exception and kills the server, causing a 502 until the restart loop kicks in.
pool.on("error", (err) => {
  console.error("[pg pool] idle client error — connection will be re-established on next query:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
