import assert from "node:assert/strict";
import test from "node:test";

import {
  diagnosticTabs,
  primaryNavigation,
} from "../src/lib/site-content.ts";

test("defines the visual entry, diagnostic introduction, and analyzer routes", () => {
  assert.deepEqual(
    primaryNavigation.map(({ href }) => href),
    ["/", "/explore", "/analyze"],
  );
});

test("uses 开始分析 for the analyzer navigation action", () => {
  assert.equal(primaryNavigation[2].label, "开始分析");
});

test("uses the three frozen MVP diagnostic labels in order", () => {
  assert.deepEqual(
    diagnosticTabs.map(({ label }) => label),
    ["思路还原", "错误解释", "修正方向"],
  );
});

test("provides useful example content for every diagnostic tab", () => {
  for (const tab of diagnosticTabs) {
    assert.ok(tab.eyebrow.length > 0);
    assert.ok(tab.title.length > 0);
    assert.ok(tab.summary.length > 0);
    assert.ok(tab.details.length >= 2);
  }
});
