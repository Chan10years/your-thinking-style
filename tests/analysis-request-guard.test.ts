import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnalysisRequestGuard,
} from "../src/lib/analysis-request-guard";

test("allows three completed requests in one rolling minute and rejects the fourth", () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const guard = createAnalysisRequestGuard();

  for (const now of [1_000, 11_000, 21_000]) {
    assert.deepEqual(guard.begin(sessionId, now), { allowed: true });
    guard.finish(sessionId);
  }

  assert.deepEqual(guard.begin(sessionId, 30_000), {
    allowed: false,
    reason: "rate_limited",
    retryAfterSeconds: 31,
  });
});

test("rejects a simultaneous request without consuming a rate-limit slot", () => {
  const sessionId = "22222222-2222-4222-8222-222222222222";
  const guard = createAnalysisRequestGuard();

  assert.deepEqual(guard.begin(sessionId, 1_000), { allowed: true });
  assert.deepEqual(guard.begin(sessionId, 1_001), {
    allowed: false,
    reason: "in_progress",
  });

  guard.finish(sessionId);

  assert.deepEqual(guard.begin(sessionId, 1_002), { allowed: true });
  guard.finish(sessionId);
  assert.deepEqual(guard.begin(sessionId, 1_003), { allowed: true });
  guard.finish(sessionId);
  assert.deepEqual(guard.begin(sessionId, 1_004), {
    allowed: false,
    reason: "rate_limited",
    retryAfterSeconds: 60,
  });
});

test("expires request timestamps after sixty seconds", () => {
  const sessionId = "33333333-3333-4333-8333-333333333333";
  const guard = createAnalysisRequestGuard();

  for (const now of [1_000, 2_000, 3_000]) {
    assert.deepEqual(guard.begin(sessionId, now), { allowed: true });
    guard.finish(sessionId);
  }

  assert.deepEqual(guard.begin(sessionId, 61_001), { allowed: true });
});
