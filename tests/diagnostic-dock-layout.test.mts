import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultDiagnosticDockLayout,
  DIAGNOSTIC_PANEL_IDS,
  getDiagnosticPanelLabel,
  mergeDiagnosticPanelIntoGroup,
  moveDiagnosticPanelToDirection,
  moveDiagnosticTabWithinGroup,
  parseDiagnosticDockLayout,
  resizeDiagnosticSplit,
  setDiagnosticActiveTab,
} from "../src/lib/diagnostic-dock-layout";

test("creates the default single tab group", () => {
  const layout = createDefaultDiagnosticDockLayout();

  assert.deepEqual(DIAGNOSTIC_PANEL_IDS, [
    "thoughtRestoration",
    "errorExplanation",
    "fixDirection",
  ]);
  assert.equal(getDiagnosticPanelLabel("thoughtRestoration"), "思路还原");
  assert.equal(getDiagnosticPanelLabel("errorExplanation"), "错误解释");
  assert.equal(getDiagnosticPanelLabel("fixDirection"), "修正方向");
  assert.equal(layout.type, "tabs");
  assert.deepEqual(layout.tabs, [
    "thoughtRestoration",
    "errorExplanation",
    "fixDirection",
  ]);
  assert.equal(layout.activeTab, "thoughtRestoration");
});

test("reset returns a fresh default layout", () => {
  const first = createDefaultDiagnosticDockLayout();
  const second = createDefaultDiagnosticDockLayout();

  first.tabs.reverse();

  assert.deepEqual(second.tabs, [
    "thoughtRestoration",
    "errorExplanation",
    "fixDirection",
  ]);
});

test("parses invalid layout as the default layout", () => {
  assert.deepEqual(
    parseDiagnosticDockLayout({ type: "unknown" }),
    createDefaultDiagnosticDockLayout(),
  );
});

test("reorders tabs inside a group", () => {
  const layout = moveDiagnosticTabWithinGroup(
    createDefaultDiagnosticDockLayout(),
    "root",
    "fixDirection",
    "thoughtRestoration",
  );

  assert.equal(layout.type, "tabs");
  assert.deepEqual(layout.tabs, [
    "fixDirection",
    "thoughtRestoration",
    "errorExplanation",
  ]);
  assert.equal(layout.activeTab, "fixDirection");
});

test("splits a panel toward a direction", () => {
  const layout = moveDiagnosticPanelToDirection(
    createDefaultDiagnosticDockLayout(),
    "fixDirection",
    "thoughtRestoration",
    "right",
  );

  assert.equal(layout.type, "split");
  assert.equal(layout.orientation, "horizontal");
  assert.deepEqual(layout.sizes, [50, 50]);
  assert.equal(layout.first.type, "tabs");
  assert.deepEqual(layout.first.tabs, [
    "thoughtRestoration",
    "errorExplanation",
  ]);
  assert.equal(layout.second.type, "tabs");
  assert.deepEqual(layout.second.tabs, ["fixDirection"]);
});

test("merges a panel into an existing group", () => {
  const split = moveDiagnosticPanelToDirection(
    createDefaultDiagnosticDockLayout(),
    "fixDirection",
    "thoughtRestoration",
    "right",
  );
  const merged = mergeDiagnosticPanelIntoGroup(
    split,
    "fixDirection",
    "root-first",
  );

  assert.equal(merged.type, "tabs");
  assert.deepEqual(merged.tabs, [
    "thoughtRestoration",
    "errorExplanation",
    "fixDirection",
  ]);
  assert.equal(merged.activeTab, "fixDirection");
});

test("updates split sizes for a split group", () => {
  const split = moveDiagnosticPanelToDirection(
    createDefaultDiagnosticDockLayout(),
    "fixDirection",
    "thoughtRestoration",
    "bottom",
  );
  const resized = resizeDiagnosticSplit(split, "root", [63, 37]);

  assert.equal(resized.type, "split");
  assert.equal(resized.orientation, "vertical");
  assert.deepEqual(resized.sizes, [63, 37]);
});

test("sets the active tab inside a group", () => {
  const layout = setDiagnosticActiveTab(
    createDefaultDiagnosticDockLayout(),
    "root",
    "fixDirection",
  );

  assert.equal(layout.type, "tabs");
  assert.equal(layout.activeTab, "fixDirection");
});
