import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    "MIGRATION_DATABASE_URL is required for Drizzle commands. Use a direct or session PostgreSQL connection URL.",
  );
}

let parsedMigrationUrl: URL;
try {
  parsedMigrationUrl = new URL(migrationUrl);
} catch {
  throw new Error("MIGRATION_DATABASE_URL must be a valid PostgreSQL connection URL.");
}
if (
  !["postgres:", "postgresql:"].includes(parsedMigrationUrl.protocol) ||
  !parsedMigrationUrl.hostname ||
  parsedMigrationUrl.pathname === "/"
) {
  throw new Error(
    "MIGRATION_DATABASE_URL must use postgres:// or postgresql:// and include a database name.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl,
  },
  strict: true,
  verbose: true,
});
