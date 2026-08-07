import assert from "node:assert/strict";
import test from "node:test";

import { AUTH_POLICY, getAuth } from "../src/server/auth/config.ts";

test("keeps the first release authentication policy intentionally small", () => {
  assert.deepEqual(AUTH_POLICY, {
    sessionExpiresInSeconds: 60 * 60 * 24 * 30,
    sessionUpdateAgeInSeconds: 60 * 60 * 24,
    requireEmailVerification: true,
    autoSignInAfterSignUp: false,
    revokeSessionsOnPasswordReset: true,
    socialProvidersEnabled: false,
    multiFactorEnabled: false,
  });
});

test("local mode never initializes Better Auth", async () => {
  await assert.rejects(
    () => getAuth({ APP_EDITION: "local" }),
    (error: unknown) =>
      error instanceof Error && error.message === "AUTH_DISABLED",
  );
});

test("hosted mode validates required account environment before initialization", async () => {
  await assert.rejects(
    () => getAuth({ APP_EDITION: "hosted" }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "DATABASE_URL is required in hosted mode",
  );
});
