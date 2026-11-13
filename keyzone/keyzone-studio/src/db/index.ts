import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse one pool across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const pool = new Pool({
    connectionString: env().DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 300,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  // pg removes failed idle clients itself. Handle the event so a database restart
  // does not crash the web/worker process; new requests can reconnect normally.
  pool.on("error", (error) => console.error("[database] Idle connection lost:", error.message));
  return pool;
}

export const pool = globalForDb.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
