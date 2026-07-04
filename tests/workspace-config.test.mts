import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORKSPACE_LAYOUT,
  FAILURE_TABS,
  parseWorkspaceLayout,
  THEME_OPTIONS,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  WORKSPACE_RATIOS,
} from "../src/lib/workspace-config.ts";

test("offers system, light, and dark themes in that order", () => {
  assert.deepEqual(
    THEME_OPTIONS.map(({ value, label }) => ({ value, label })),
    [
      { value: "system", label: "跟随系统" },
      { value: "light", label: "浅色" },
      { value: "dark", label: "深色" },
    ],
  );
});

test("maps failure tabs to the existing independent input fields", () => {
  assert.deepEqual(
    FAILURE_TABS.map(({ field, label, limit }) => ({ field, label, limit })),
    [
      { field: "failureInput", label: "失败输入", limit: 2000 },
      { field: "expectedOutput", label: "预期输出", limit: 1000 },
      { field: "actualOutput", label: "实际输出 / 报错", limit: 2000 },
    ],
  );
});

test("freezes the requested desktop workspace proportions", () => {
  assert.deepEqual(WORKSPACE_RATIOS, {
    mainLeft: 45,
    mainRight: 55,
    code: 60,
    supplemental: 40,
    thought: 45,
    failure: 55,
  });
});

test("uses one project-prefixed storage key for all pane layouts", () => {
  assert.equal(
    WORKSPACE_LAYOUT_STORAGE_KEY,
    "yourthinkingstyle.workspace.layout",
  );
  assert.deepEqual(DEFAULT_WORKSPACE_LAYOUT, {
    main: { problem: 45, workspace: 55 },
    right: { code: 60, supplemental: 40 },
    supplemental: { thought: 45, failure: 55 },
  });
});

test("parses a complete persisted workspace layout", () => {
  const parsed = parseWorkspaceLayout(
    JSON.stringify({
      main: { problem: 40, workspace: 60 },
      right: { code: 64, supplemental: 36 },
      supplemental: { thought: 48, failure: 52 },
    }),
  );

  assert.deepEqual(parsed, {
    main: { problem: 40, workspace: 60 },
    right: { code: 64, supplemental: 36 },
    supplemental: { thought: 48, failure: 52 },
  });
});

test("falls back to defaults for absent, malformed, or incomplete layouts", () => {
  assert.deepEqual(parseWorkspaceLayout(null), DEFAULT_WORKSPACE_LAYOUT);
  assert.deepEqual(parseWorkspaceLayout("{bad json"), DEFAULT_WORKSPACE_LAYOUT);
  assert.deepEqual(
    parseWorkspaceLayout(
      JSON.stringify({
        main: { problem: -2, workspace: 102 },
        right: { code: 60, supplemental: 40 },
      }),
    ),
    DEFAULT_WORKSPACE_LAYOUT,
  );
});
