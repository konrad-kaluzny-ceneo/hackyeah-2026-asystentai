import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;

/**
 * Lazily creates a shared pg Pool + Drizzle client.
 *
 * The first call requires `process.env.DATABASE_URL`. We intentionally do NOT
 * throw at module scope so that importing this module in environments without
 * a database (e.g. unit tests, local dev with the feature disabled) stays
 * side-effect free.
 */
export function getDb(): Database {
  if (db !== undefined) {
    return db;
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Configure it (see .env.example) or disable persistence.",
    );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error(
      `DATABASE_URL must use a PostgreSQL scheme (postgres:// or postgresql://); received ${parsedUrl.protocol || "no scheme"}.`,
    );
  }
  pool = new Pool({ connectionString: url, max: 1 });
  db = drizzle(pool, { schema });
  return db;
}

/** Test hook: replaces the lazily-created client with a custom one. */
export function setDbForTests(custom: Database | undefined): void {
  db = custom;
}

/** Closes the underlying pool. Call during graceful shutdown (optional). */
export async function closeDb(): Promise<void> {
  if (pool !== undefined) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
