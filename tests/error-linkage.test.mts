import assert from "node:assert/strict";
import test from "node:test";

import {
  activateErrorFromCard,
  buildRedErrorLinks,
  createRedErrorDecorations,
  mapDecorationIdsToRedErrors,
  resolveClickedRedErrorId,
} from "../src/lib/error-linkage";
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
    redErrorsUnavailableReason: "",
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

const sameLineAnalysis = createAnalysis({
  redErrors: [
    {
      id: "错误 1",
      location: location("left", 1, 7),
      errorType: "logic_error",
      evidenceLevel: "confirmed",
      evidenceSources: ["static_analysis"],
      title: "左侧错误",
      explanation: "左侧条件错误。",
      runtimeConsequence: "分支错误。",
      localFixSuggestion: "修正左侧条件。",
    },
    {
      id: "错误 2",
      location: location("right", 1, 17),
      errorType: "logic_error",
      evidenceLevel: "confirmed",
      evidenceSources: ["static_analysis"],
      title: "右侧错误",
      explanation: "右侧条件错误。",
      runtimeConsequence: "分支错误。",
      localFixSuggestion: "修正右侧条件。",
    },
  ],
});

test("clicking an error card activates the correct id and reveals its Monaco range", () => {
  const links = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const calls: string[] = [];

  const activated = activateErrorFromCard("错误 2", links, {
    setActiveErrorId: (id) => calls.push(`active:${id}`),
    setSelection: (range) =>
      calls.push(`selection:${range.startColumn}-${range.endColumn}`),
    revealRangeInCenterIfOutsideViewport: (range) =>
      calls.push(`reveal:${range.startColumn}-${range.endColumn}`),
    focus: () => calls.push("focus"),
  });

  assert.equal(activated, true);
  assert.deepEqual(calls, [
    "active:错误 2",
    "selection:13-18",
    "reveal:13-18",
    "focus",
  ]);
});

test("clicking an unlocated error card does not jump Monaco", () => {
  const analysis = createAnalysis({
    redErrors: [
      {
        ...sameLineAnalysis.redErrors[0],
        location: location("missing", 8, 1),
      },
    ],
  });
  const links = buildRedErrorLinks("if (left && right) {}", analysis);
  const calls: string[] = [];

  const activated = activateErrorFromCard("错误 1", links, {
    setActiveErrorId: (id) => calls.push(`active:${id}`),
    setSelection: () => calls.push("selection"),
    revealRangeInCenterIfOutsideViewport: () => calls.push("reveal"),
    focus: () => calls.push("focus"),
  });

  assert.equal(activated, false);
  assert.deepEqual(calls, ["active:错误 1"]);
  assert.equal(links[0].status.label, "代码位置未能可靠定位");
});

test("clicking a red Monaco decoration activates the matching card", () => {
  const links = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const decorationIdMap = mapDecorationIdsToRedErrors(links, ["d1", "d2"]);

  const clickedId = resolveClickedRedErrorId(
    {
      position: { lineNumber: 1, column: 14 },
      lineDecorations: [
        { id: "d1", range: links[0].range },
        { id: "d2", range: links[1].range },
      ],
    },
    links,
    decorationIdMap,
  );

  assert.equal(clickedId, "错误 2");
});

test("clicking ordinary code does not switch active error", () => {
  const links = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const decorationIdMap = mapDecorationIdsToRedErrors(links, ["d1", "d2"]);

  const clickedId = resolveClickedRedErrorId(
    {
      position: { lineNumber: 1, column: 4 },
      lineDecorations: [
        { id: "d1", range: links[0].range },
        { id: "d2", range: links[1].range },
      ],
    },
    links,
    decorationIdMap,
  );

  assert.equal(clickedId, null);
});

test("same-line red errors are distinguished by column range", () => {
  const links = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const decorationIdMap = mapDecorationIdsToRedErrors(links, ["d1", "d2"]);

  assert.equal(
    resolveClickedRedErrorId(
      {
        position: { lineNumber: 1, column: 6 },
        lineDecorations: [
          { id: "d1", range: links[0].range },
          { id: "d2", range: links[1].range },
        ],
      },
      links,
      decorationIdMap,
    ),
    "错误 1",
  );
  assert.equal(
    resolveClickedRedErrorId(
      {
        position: { lineNumber: 1, column: 16 },
        lineDecorations: [
          { id: "d1", range: links[0].range },
          { id: "d2", range: links[1].range },
        ],
      },
      links,
      decorationIdMap,
    ),
    "错误 2",
  );
});

test("active error creates active red decoration styling", () => {
  const links = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const decorations = createRedErrorDecorations(links, "错误 2");

  assert.equal(decorations.length, 2);
  assert.equal(
    decorations[0].options.className?.includes("code-annotation--red-active"),
    false,
  );
  assert.equal(
    decorations[1].options.className?.includes("code-annotation--red-active"),
    true,
  );
});

test("decoration rebuild invalidates old ids without duplicate matches", () => {
  const oldLinks = buildRedErrorLinks("if (left && right) {}", sameLineAnalysis);
  const oldMap = mapDecorationIdsToRedErrors(oldLinks, ["old1", "old2"]);
  const nextAnalysis = createAnalysis({
    redErrors: [
      {
        ...sameLineAnalysis.redErrors[0],
        id: "错误 1",
        location: location("next", 1, 1),
      },
    ],
  });
  const nextLinks = buildRedErrorLinks("next value", nextAnalysis);
  const nextMap = mapDecorationIdsToRedErrors(nextLinks, ["new1"]);

  assert.equal(oldMap.get("old2"), "错误 2");
  assert.equal(nextMap.has("old2"), false);
  assert.equal(nextMap.get("new1"), "错误 1");
});
