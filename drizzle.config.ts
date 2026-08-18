import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://yourthinkingstyle:yourthinkingstyle@localhost:5432/yourthinkingstyle",
  },
  strict: true,
  verbose: true,
});
