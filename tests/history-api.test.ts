import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHistoryRecord,
  parseHistoryListQuery,
} from "../src/server/history/query.ts";

test("uses a default page of 20 and caps requested pages at 50", () => {
  assert.deepEqual(parseHistoryListQuery(new URLSearchParams()), {
    limit: 20,
    offset: 0,
  });
  assert.deepEqual(
    parseHistoryListQuery(new URLSearchParams("limit=500&offset=40")),
    { limit: 50, offset: 40 },
  );
});

test("rejects malformed history pagination", () => {
  assert.throws(
    () => parseHistoryListQuery(new URLSearchParams("limit=0")),
    /分页参数/,
  );
  assert.throws(
    () => parseHistoryListQuery(new URLSearchParams("offset=-1")),
    /分页参数/,
  );
});

test("formats only replayable inputs and structured results", () => {
  const record = formatHistoryRecord({
    id: "00000000-0000-0000-0000-000000000000",
    userId: "user-a",
    problem: "题目",
    code: "int main() {}",
    userThought: "思路",
    failureInput: "1",
    expectedOutput: "2",
    actualOutput: "0",
    schemaVersion: "mvp-1",
    result: { schemaVersion: "mvp-1" },
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
  });

  assert.deepEqual(record, {
    id: "00000000-0000-0000-0000-000000000000",
    createdAt: "2026-08-07T00:00:00.000Z",
    input: {
      problem: "题目",
      code: "int main() {}",
      userThought: "思路",
      failureInput: "1",
      expectedOutput: "2",
      actualOutput: "0",
    },
    schemaVersion: "mvp-1",
    result: { schemaVersion: "mvp-1" },
  });
});

test("local history routes are unavailable", async () => {
  const listRoute = await import("../src/app/api/history/route.ts");
  const response = await listRoute.GET(
    new Request("http://localhost:3000/api/history"),
  );
  assert.equal(response.status, 404);
});
