import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppEdition,
  getEditionCapabilities,
  getHostedEnvironment,
} from "../src/config/edition.ts";

test("defaults to local edition without hosted services", () => {
  assert.equal(getAppEdition({}), "local");
  assert.deepEqual(getEditionCapabilities("local"), {
    allowsAnonymousAnalysis: true,
    requiresAuthentication: false,
    requiresDatabase: false,
    persistsHistory: false,
    collectsUsageStats: false,
    sendsOfficialTelemetry: false,
  });
});

test("rejects unknown editions instead of silently enabling hosted mode", () => {
  assert.throws(
    () => getAppEdition({ APP_EDITION: "preview" }),
    /APP_EDITION must be local or hosted/,
  );
});

test("hosted capabilities require the account and persistence services", () => {
  assert.deepEqual(getEditionCapabilities("hosted"), {
    allowsAnonymousAnalysis: false,
    requiresAuthentication: true,
    requiresDatabase: true,
    persistsHistory: true,
    collectsUsageStats: true,
    sendsOfficialTelemetry: false,
  });
});

test("hosted environment validates required secrets without loading in local mode", () => {
  assert.throws(
    () => getHostedEnvironment({}),
    /DATABASE_URL is required in hosted mode/,
  );

  assert.deepEqual(
    getHostedEnvironment({
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "a".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
    }),
    {
      databaseUrl: "postgres://app:app@localhost:5432/app",
      betterAuthSecret: "a".repeat(32),
      betterAuthUrl: "http://localhost:3000",
      mailFrom: "no-reply@localhost",
      avatarStorageDir: ".data/avatars",
    },
  );
});
