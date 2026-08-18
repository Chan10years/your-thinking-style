import assert from "node:assert/strict";
import test from "node:test";

import {
  formatUsageReport,
  getStatsEnvironment,
  type UsageMetrics,
} from "../src/server/stats/service.ts";

test("local mode cannot export usage statistics", () => {
  assert.throws(
    () => getStatsEnvironment({ APP_EDITION: "local" }),
    /STATS_DISABLED/,
  );
});

test("formats only the planned aggregate metrics", () => {
  const metrics: UsageMetrics = {
    generatedAt: "2026-08-07T00:00:00.000Z",
    registeredUsers: 10,
    verifiedUsers: 8,
    dau: 3,
    wau: 6,
    mau: 9,
    successfulDiagnoses: 20,
    averageDiagnosesPerRegisteredUser: 2,
    sevenDayReturnUsers: 4,
  };

  assert.deepEqual(formatUsageReport(metrics), metrics);
  assert.equal("email" in metrics, false);
  assert.equal("apiKey" in metrics, false);
  assert.equal("prompt" in metrics, false);
});
