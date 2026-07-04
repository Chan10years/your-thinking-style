import assert from "node:assert/strict";
import test from "node:test";

import {
  locateExactCode,
  type CodeLocationHint,
} from "../src/lib/code-location-resolver";

function hint(
  startLine: number,
  startColumn: number,
): CodeLocationHint {
  return {
    startLine,
    startColumn,
    endLine: startLine,
    endColumn: startColumn + 1,
  };
}

test("locates a unique single-line exactCode match", () => {
  const result = locateExactCode("int ans = 0;\ncout << ans;", "ans = 0", hint(99, 99));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 12,
    });
  }
});

test("locates a unique multi-line exactCode match", () => {
  const exactCode = "for (int i = 0; i < n; i++) {\n  sum += a[i];\n}";
  const sourceCode = `int sum = 0;\n${exactCode}\ncout << sum;`;

  const result = locateExactCode(sourceCode, exactCode, hint(1, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 4,
      endColumn: 2,
    });
  }
});

test("preserves leading spaces and indentation during matching", () => {
  const sourceCode = "int main() {\n    if (ok) {\n        solve();\n    }\n}";
  const exactCode = "    if (ok) {\n        solve();\n    }";

  const result = locateExactCode(sourceCode, exactCode, hint(2, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 4,
      endColumn: 6,
    });
  }
});

test("handles exactCode ending with a trailing newline", () => {
  const sourceCode = "return 0;\n";

  const result = locateExactCode(sourceCode, "return 0;\n", hint(1, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 1,
      startColumn: 1,
      endLine: 2,
      endColumn: 1,
    });
  }
});

test("handles Windows CRLF line endings", () => {
  const sourceCode = "int x = 0;\r\nx++;\r\ncout << x;";

  const result = locateExactCode(sourceCode, "x++;\r\ncout", hint(2, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 3,
      endColumn: 5,
    });
  }
});

test("handles Unix LF line endings", () => {
  const sourceCode = "int x = 0;\nx++;\ncout << x;";

  const result = locateExactCode(sourceCode, "x++;\ncout", hint(2, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 3,
      endColumn: 5,
    });
  }
});

test("reports when exactCode cannot be matched", () => {
  const result = locateExactCode("int x = 0;", "int y = 0;", hint(1, 1));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "no_match");
  }
});

test("reports empty exactCode as a location failure", () => {
  const result = locateExactCode("int x = 0;", "", hint(1, 1));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "empty_exact_code");
  }
});

test("disambiguates duplicate exactCode by the nearest model start hint", () => {
  const sourceCode = "if (x) ans++;\nif (x) ans++;\nif (x) ans++;";

  const result = locateExactCode(sourceCode, "if (x) ans++;", hint(3, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 3,
      startColumn: 1,
      endLine: 3,
      endColumn: 14,
    });
  }
});

test("rejects duplicate exactCode when candidates tie by distance", () => {
  const sourceCode = "x++;\nmid();\nx++;";

  const result = locateExactCode(sourceCode, "x++;", hint(2, 1));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "ambiguous_match");
  }
});

test("ignores an incorrect model line when exactCode is unique", () => {
  const result = locateExactCode("a();\nb();\nc();", "b();", hint(20, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 5,
    });
  }
});

test("ignores an out-of-bounds model range when exactCode is unique", () => {
  const result = locateExactCode("a();\nb();", "a();", {
    startLine: 100,
    startColumn: 200,
    endLine: 100,
    endColumn: 201,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 5,
    });
  }
});

test("calculates columns around Chinese and Unicode characters", () => {
  const sourceCode = "int 数量 = 1;\n数量++;";

  const result = locateExactCode(sourceCode, "数量++", hint(2, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 5,
    });
  }
});

test("reports no match for empty source code", () => {
  const result = locateExactCode("", "int main()", hint(1, 1));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "no_match");
  }
});

test("locates the whole source when it is used as exactCode", () => {
  const sourceCode = "int main() {\n  return 0;\n}";

  const result = locateExactCode(sourceCode, sourceCode, hint(1, 1));

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.range, {
      startLine: 1,
      startColumn: 1,
      endLine: 3,
      endColumn: 2,
    });
  }
});
