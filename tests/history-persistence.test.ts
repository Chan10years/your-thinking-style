import assert from "node:assert/strict";
import test from "node:test";

import { buildHistoryInsert } from "../src/server/history/persistence.ts";

test("history insert contains only replay inputs and validated structured output", () => {
  const record = buildHistoryInsert(
    "user-123",
    {
      problem: "two sum",
      code: "int main() {}",
      userThought: "想法",
      failureInput: "1 2",
      expectedOutput: "3",
      actualOutput: "0",
    },
    {
      schemaVersion: "mvp-1",
      thoughtRestoration: { status: "implementation_bug" },
    },
  );

  assert.deepEqual(record, {
    userId: "user-123",
    problem: "two sum",
    code: "int main() {}",
    userThought: "想法",
    failureInput: "1 2",
    expectedOutput: "3",
    actualOutput: "0",
    schemaVersion: "mvp-1",
    result: {
      schemaVersion: "mvp-1",
      thoughtRestoration: { status: "implementation_bug" },
    },
  });
  assert.equal("apiKey" in record, false);
  assert.equal("prompt" in record, false);
  assert.equal("rawResponse" in record, false);
});
