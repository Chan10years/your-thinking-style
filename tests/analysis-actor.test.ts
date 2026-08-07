import assert from "node:assert/strict";
import test from "node:test";

import { resolveAnalysisActor } from "../src/server/analysis/actor.ts";

test("local analysis resolves to an anonymous browser actor", async () => {
  const actor = await resolveAnalysisActor(
    new Request("http://localhost:3000/api/analyze", {
      headers: { "x-analysis-session-id": "browser-session-123456" },
    }),
    { APP_EDITION: "local" },
  );

  assert.deepEqual(actor, {
    type: "local",
    sessionId: "browser-session-123456",
  });
});

test("hosted analysis never falls back to an anonymous actor", async () => {
  await assert.rejects(
    () =>
      resolveAnalysisActor(
        new Request("http://localhost:3000/api/analyze"),
        { APP_EDITION: "hosted" },
      ),
    /DATABASE_URL is required in hosted mode/,
  );
});
