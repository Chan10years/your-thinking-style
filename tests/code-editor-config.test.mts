import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/code-editor.tsx", "utf8");
const errorLinkageSource = readFileSync("src/lib/error-linkage.ts", "utf8");

test("configures Monaco Editor to load from the local dependency", () => {
  assert.doesNotMatch(source, /import \* as monaco from "monaco-editor";/);
  assert.match(source, /import\("monaco-editor"\)/);
  assert.match(source, /loader\.config\(\{\s*monaco\s*\}\);/s);
});

test("uses Monaco decorations without changing editor text", () => {
  assert.match(source, /decorations\?:\s*editor\.IModelDeltaDecoration\[\]/);
  assert.match(source, /editorInstance\.deltaDecorations\(/);
  assert.match(source, /decorationIdsRef/);
  assert.match(source, /onChange=\{\(nextValue\) => onChange\(nextValue \?\? ""\)\}/);
});

test("replaces and clears stale Monaco decorations", () => {
  assert.match(
    source,
    /deltaDecorations\(\s*decorationIdsRef\.current,\s*decorations,\s*\)/s,
  );
  assert.match(
    source,
    /deltaDecorations\(\s*decorationIdsRef\.current,\s*\[\],\s*\)/s,
  );
});

test("enables glyph margin for red error badges", () => {
  assert.match(source, /glyphMargin:\s*true/);
  assert.match(errorLinkageSource, /code-annotation-glyph--red/);
});

test("declares red and blue annotation style classes", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.match(css, /\.code-annotation--blue/);
  assert.match(css, /\.code-annotation--red/);
  assert.match(css, /\.code-annotation-glyph--red/);
  assert.match(css, /\.code-annotation-badge--red/);
});
