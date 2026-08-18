import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationFiles = (await readdir(new URL("../drizzle/", import.meta.url)))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migration = (
  await Promise.all(
    migrationFiles.map((file) =>
      readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8"),
    ),
  )
).join("\n");
const normalizedMigration = migration.toLowerCase();

test("creates Better Auth, profile, history, and activity tables", () => {
  for (const table of [
    '"user"',
    '"session"',
    '"account"',
    '"verification"',
    '"user_profiles"',
    '"analysis_history"',
    '"daily_user_activity"',
  ]) {
    assert.match(normalizedMigration, new RegExp(`create table if not exists ${table}`));
  }
});

test("keeps ownership and query indexes in the first migration", () => {
  for (const indexName of [
    "session_user_id_idx",
    "account_user_id_idx",
    "verification_identifier_idx",
    "analysis_history_user_created_idx",
    "daily_user_activity_date_idx",
  ]) {
    assert.match(normalizedMigration, new RegExp(`create index if not exists [^\\n]*${indexName}`));
  }
});

test("is safe to apply repeatedly and contains no destructive migration", () => {
  assert.doesNotMatch(normalizedMigration, /drop\s+(table|index|schema)/);
  assert.doesNotMatch(normalizedMigration, /truncate\s+table/);
  assert.doesNotMatch(normalizedMigration, /delete\s+from/);
  assert.match(normalizedMigration, /create table if not exists/);
  assert.match(normalizedMigration, /create index if not exists/);
});

test("never persists API keys, prompts, or raw upstream responses", () => {
  assert.doesNotMatch(normalizedMigration, /api[_ ]?key/);
  assert.doesNotMatch(normalizedMigration, /prompt/);
  assert.doesNotMatch(normalizedMigration, /raw[_ ]?response/);
});
