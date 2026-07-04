import assert from "node:assert/strict";
import test from "node:test";

import { buildCodeAnnotations } from "../src/lib/code-annotation-decorations";
import type { AnalysisResponse } from "../src/types/analysis";

function location(exactCode: string, startLine = 1, startColumn = 1) {
  return {
    startLine,
    startColumn,
    endLine: startLine,
    endColumn: startColumn + Math.max(exactCode.length, 1),
    exactCode,
  };
}

function createAnalysis(
  overrides: Partial<AnalysisResponse> = {},
): AnalysisResponse {
  return {
    schemaVersion: "mvp-1",
    thoughtRestoration: {
      status: "implementation_bug",
      userThoughtSummary: "用户希望线性扫描。",
      codeBehaviorSummary: "代码执行了线性扫描。",
      consistencyAnalysis: "思路与代码大体一致。",
      deviationPoint: "初始化位置存在偏差。",
      canBeFixedAlongOriginalThought: true,
      reasoning: "核心流程可保留。",
      confidence: "high",
    },
    blueBlocks: [],
    redErrors: [],
    redErrorsUnavailableReason: "无法定位明确错误。",
    suspectedIssues: [],
    fixDirection: {
      personalizedPath: {
        strategy: "保留扫描。",
        steps: ["修正局部错误。"],
        keyAlgorithmOrDataStructure: "线性扫描",
        referenceCode: {
          available: true,
          codeType: "partial_code",
          language: "cpp",
          code: "int ans = a[0];",
          unavailableReason: "",
        },
        achievableLevel: "partial_data",
        limitations: [],
      },
      standardPath: {
        strategy: "标准扫描。",
        steps: ["读取。", "扫描。"],
        keyAlgorithmOrDataStructure: "线性扫描",
        referenceCode: {
          available: true,
          codeType: "full_code",
          language: "cpp",
          code: "int main(){return 0;}",
          unavailableReason: "",
        },
        advantagesOverPersonalizedPath: ["更稳。"],
      },
      newKnowledgeNeeded: [],
    },
    meta: {
      analysisBasis: ["problem", "code"],
      limitations: ["未运行代码。"],
      needsUserVerification: true,
    },
    ...overrides,
  };
}

test("maps multiple blue blocks into blue Monaco decorations", () => {
  const sourceCode = "read();\nsolve();\nprint();";
  const analysis = createAnalysis({
    blueBlocks: [
      { location: location("read()", 1, 1), reason: "读取输入。" },
      { location: location("solve()", 2, 1), reason: "核心计算。" },
    ],
  });

  const result = buildCodeAnnotations(sourceCode, analysis);

  assert.equal(result.blueDecorations.length, 2);
  assert.deepEqual(
    result.blueDecorations.map((decoration) => decoration.range),
    [
      {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 7,
      },
      {
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 8,
      },
    ],
  );
  assert.ok(
    result.blueDecorations.every((decoration) =>
      decoration.options.className?.includes("code-annotation--blue"),
    ),
  );
});

test("maps multiple red errors into numbered red decorations", () => {
  const sourceCode = "int ans = 0;\nreturn ans;";
  const analysis = createAnalysis({
    redErrorsUnavailableReason: "",
    redErrors: [
      {
        id: "错误 1",
        location: location("ans = 0", 1, 5),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "初始化错误",
        explanation: "0 不适合全负数。",
        runtimeConsequence: "输出错误。",
        localFixSuggestion: "用首个值初始化。",
      },
      {
        id: "错误 2",
        location: location("return ans", 2, 1),
        errorType: "boundary_case_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["failure_case"],
        title: "返回位置错误",
        explanation: "提前返回。",
        runtimeConsequence: "漏处理数据。",
        localFixSuggestion: "移到循环后。",
      },
    ],
  });

  const result = buildCodeAnnotations(sourceCode, analysis);

  assert.equal(result.redDecorations.length, 2);
  assert.deepEqual(
    result.redDecorations.map(
      (decoration) => decoration.options.before?.content,
    ),
    ["1", "2"],
  );
  assert.deepEqual(
    result.redErrorStatuses.map((status) => ({
      id: status.id,
      located: status.located,
      label: status.label,
    })),
    [
      { id: "错误 1", located: true, label: "已定位代码位置" },
      { id: "错误 2", located: true, label: "已定位代码位置" },
    ],
  );
});

test("keeps red decorations visually above overlapping blue decorations", () => {
  const sourceCode = "for (;;) {\n  ans = 0;\n}";
  const analysis = createAnalysis({
    blueBlocks: [
      {
        location: location("for (;;) {\n  ans = 0;\n}", 1, 1),
        reason: "核心循环。",
      },
    ],
    redErrorsUnavailableReason: "",
    redErrors: [
      {
        id: "错误 1",
        location: location("ans = 0", 2, 3),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "初始化错误",
        explanation: "初始化位置错误。",
        runtimeConsequence: "覆盖结果。",
        localFixSuggestion: "移出循环。",
      },
    ],
  });

  const result = buildCodeAnnotations(sourceCode, analysis);

  assert.equal(result.blueDecorations.length, 1);
  assert.equal(result.redDecorations.length, 1);
  assert.ok(
    Number(result.redDecorations[0].options.zIndex) >
      Number(result.blueDecorations[0].options.zIndex),
  );
});

test("keeps successful annotations when some entries cannot be located", () => {
  const sourceCode = "read();\nsolve();";
  const analysis = createAnalysis({
    blueBlocks: [
      { location: location("read()", 1, 1), reason: "读取。" },
      { location: location("missing()", 9, 1), reason: "不存在。" },
    ],
    redErrorsUnavailableReason: "",
    redErrors: [
      {
        id: "错误 1",
        location: location("solve()", 2, 1),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "错误",
        explanation: "说明。",
        runtimeConsequence: "后果。",
        localFixSuggestion: "建议。",
      },
      {
        id: "错误 2",
        location: location("missing()", 4, 1),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "未定位错误",
        explanation: "说明。",
        runtimeConsequence: "后果。",
        localFixSuggestion: "建议。",
      },
    ],
  });

  const result = buildCodeAnnotations(sourceCode, analysis);

  assert.equal(result.blueDecorations.length, 1);
  assert.equal(result.redDecorations.length, 1);
  assert.deepEqual(
    result.redErrorStatuses.map((status) => status.located),
    [true, false],
  );
  assert.equal(
    result.redErrorStatuses[1].label,
    "代码位置未能可靠定位",
  );
});

test("returns no decorations when all entries fail to locate", () => {
  const analysis = createAnalysis({
    blueBlocks: [{ location: location("missing blue"), reason: "不存在。" }],
    redErrors: [
      {
        id: "错误 1",
        location: location("missing red"),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "未定位错误",
        explanation: "说明。",
        runtimeConsequence: "后果。",
        localFixSuggestion: "建议。",
      },
    ],
  });

  const result = buildCodeAnnotations("int main() {}", analysis);

  assert.equal(result.blueDecorations.length, 0);
  assert.equal(result.redDecorations.length, 0);
  assert.deepEqual(
    result.redErrorStatuses.map((status) => status.located),
    [false],
  );
});

test("handles empty blueBlocks and redErrors without meaningless decorations", () => {
  const result = buildCodeAnnotations("int main() {}", createAnalysis());

  assert.equal(result.blueDecorations.length, 0);
  assert.equal(result.redDecorations.length, 0);
  assert.deepEqual(result.redErrorStatuses, []);
});

test("preserves original red error order in statuses and decoration badges", () => {
  const analysis = createAnalysis({
    redErrorsUnavailableReason: "",
    redErrors: [
      {
        id: "错误 1",
        location: location("second", 2, 1),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "第二行错误",
        explanation: "说明。",
        runtimeConsequence: "后果。",
        localFixSuggestion: "建议。",
      },
      {
        id: "错误 2",
        location: location("first", 1, 1),
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: "第一行错误",
        explanation: "说明。",
        runtimeConsequence: "后果。",
        localFixSuggestion: "建议。",
      },
    ],
  });

  const result = buildCodeAnnotations("first\nsecond", analysis);

  assert.deepEqual(
    result.redErrorStatuses.map((status) => status.id),
    ["错误 1", "错误 2"],
  );
  assert.deepEqual(
    result.redDecorations.map(
      (decoration) => decoration.options.before?.content,
    ),
    ["1", "2"],
  );
});
