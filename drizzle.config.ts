import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Read from env at migrate/push time. Generation of SQL does not need it,
    // but drizzle-kit requires the key to exist.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
