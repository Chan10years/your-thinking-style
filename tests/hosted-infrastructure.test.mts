import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("pins the hosted persistence and avatar dependencies", () => {
  assert.equal(packageJson.dependencies["better-auth"], "1.6.25");
  assert.equal(
    packageJson.dependencies["@better-auth/drizzle-adapter"],
    "1.6.25",
  );
  assert.equal(packageJson.dependencies["drizzle-orm"], "0.45.2");
  assert.equal(packageJson.dependencies.pg, "8.22.0");
  assert.equal(packageJson.dependencies.sharp, "0.35.3");
  assert.equal(packageJson.devDependencies["drizzle-kit"], "0.31.10");
  assert.equal(packageJson.devDependencies["@types/pg"], "8.15.5");
});

test("compose provisions persistent Postgres and Mailpit with health checks", async () => {
  const compose = await readFile(
    new URL("../compose.yaml", import.meta.url),
    "utf8",
  );

  assert.match(compose, /postgres:17\.10-alpine3\.23/);
  assert.match(compose, /axllent\/mailpit:v1\.30\.0/);
  assert.match(compose, /healthcheck:/g);
  assert.match(compose, /yourthinkingstyle_postgres_data/);
  assert.match(compose, /yourthinkingstyle_mailpit_data/);
  assert.match(compose, /5432:5432/);
  assert.match(compose, /8025:8025/);
});

test("local database access is disabled before any pool is created", async () => {
  const { getDatabase } = await import("../src/server/db/client.ts");

  assert.throws(
    () => getDatabase({ APP_EDITION: "local" }),
    (error: unknown) =>
      error instanceof Error && error.message === "DATABASE_DISABLED",
  );
});
