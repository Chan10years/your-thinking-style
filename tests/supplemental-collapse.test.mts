import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzePagePath = new URL("../src/app/analyze/page.tsx", import.meta.url);

test("keeps supplemental input collapsed by default with an accessible toggle", async () => {
  const source = await readFile(analyzePagePath, "utf8");

  assert.match(
    source,
    /useState\(false\).*isSupplementalOpen|isSupplementalOpen.*useState\(false\)/s,
  );
  assert.match(source, /aria-expanded=\{isSupplementalOpen\}/);
  assert.match(source, /补充信息（可选）/);
  assert.match(source, /isSupplementalOpen\s*\?\s*\(/);
});

test("opens supplemental input when a supplemental field fails validation", async () => {
  const source = await readFile(analyzePagePath, "utf8");

  assert.match(source, /hasSupplementalInputError\(result\.errors\)/);
  assert.match(source, /setIsSupplementalOpen\(true\)/);
  assert.match(source, /supplementalPanelRef\.current\?\.expand\(\)/);
});
