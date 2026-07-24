import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAnalysisFailure,
  applyAnalysisSuccess,
  canStartAnalysisRequest,
  requestAnalysis,
} from "../src/lib/analysis-submit";
import type { AnalysisInput } from "../src/lib/input-validation";
import type { AnalysisResponse } from "../src/types/analysis";

const input: AnalysisInput = {
  problem: "当前题目",
  code: "int current_code = 1;",
  apiKey: "sk-current",
  userThought: "当前思路",
  failureInput: "1",
  expectedOutput: "2",
  actualOutput: "3",
};

const analysisA = {
  schemaVersion: "mvp-1",
  thoughtRestoration: {
    status: "implementation_bug",
    userThoughtSummary: "旧思路。",
    codeBehaviorSummary: "旧代码。",
    consistencyAnalysis: "旧一致性。",
    deviationPoint: "旧偏离。",
    canBeFixedAlongOriginalThought: true,
    reasoning: "旧依据。",
    confidence: "medium",
  },
  blueBlocks: [],
  redErrors: [],
  redErrorsUnavailableReason: "当前测试夹具没有提供可定位的明确错误。",
  suspectedIssues: [],
  fixDirection: {
    personalizedPath: {
      strategy: "旧策略。",
      steps: ["旧步骤。"],
      keyAlgorithmOrDataStructure: "旧算法",
      referenceCode: {
        available: true,
        codeType: "partial_code",
        language: "cpp",
        code: "int old_code = 0;",
        unavailableReason: "",
      },
      achievableLevel: "partial_data",
      limitations: [],
    },
    standardPath: {
      strategy: "旧标准。",
      steps: ["旧标准步骤。"],
      keyAlgorithmOrDataStructure: "旧标准算法",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "int main(){return 0;}",
        unavailableReason: "",
      },
      advantagesOverPersonalizedPath: ["旧优势。"],
    },
    newKnowledgeNeeded: [],
  },
  meta: {
    analysisBasis: ["problem", "code"],
    limitations: ["未运行代码。"],
    needsUserVerification: true,
  },
} satisfies AnalysisResponse;

const analysisB = {
  ...analysisA,
  thoughtRestoration: {
    ...analysisA.thoughtRestoration,
    codeBehaviorSummary: "新代码。",
  },
} satisfies AnalysisResponse;

test("reanalysis request sends the current problem, code, supplemental input, and API key", async () => {
  const calls: RequestInit[] = [];
  const sessionId = "44444444-4444-4444-8444-444444444444";
  const result = await requestAnalysis(input, async (_url, init) => {
    calls.push(init ?? {});
    return Response.json({ success: true, data: analysisB });
  }, sessionId);

  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0].body)), input);
  assert.equal(
    new Headers(calls[0].headers).get("x-analysis-session-id"),
    sessionId,
  );
});

test("request failure returns a clear network message", async () => {
  const result = await requestAnalysis(input, async () => {
    throw new TypeError("network down");
  });

  assert.deepEqual(result, {
    success: false,
    message: "无法连接分析服务，请检查网络后重试。",
  });
});

test("non-2xx API response uses the server error message and redacts the API key", async () => {
  const result = await requestAnalysis(input, async () =>
    Response.json(
      {
        success: false,
        error: {
          code: "DEEPSEEK_REQUEST_FAILED",
          message: `DeepSeek 拒绝了 ${input.apiKey}。`,
        },
      },
      { status: 502 },
    ),
  );

  assert.deepEqual(result, {
    success: false,
    message: "DeepSeek 拒绝了 [API Key]。",
  });
});

test("non-2xx API response cannot be treated as a successful analysis", async () => {
  const result = await requestAnalysis(input, async () =>
    Response.json(
      {
        success: true,
        data: analysisB,
      },
      { status: 500 },
    ),
  );

  assert.deepEqual(result, {
    success: false,
    message: "分析服务返回错误状态 500，请稍后重试。",
  });
});

test("non-JSON or empty API response returns a parse error message", async () => {
  const nonJson = await requestAnalysis(
    input,
    async () =>
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
  );
  const empty = await requestAnalysis(
    input,
    async () => new Response("", { status: 200 }),
  );

  assert.deepEqual(nonJson, {
    success: false,
    message: "分析服务返回的内容无法解析，请稍后重试。",
  });
  assert.deepEqual(empty, {
    success: false,
    message: "分析服务返回的内容无法解析，请稍后重试。",
  });
});

test("success payload must match the frozen analysis schema", async () => {
  const result = await requestAnalysis(input, async () =>
    Response.json({
      success: true,
      data: { schemaVersion: "mvp-1" },
    }),
  );

  assert.deepEqual(result, {
    success: false,
    message: "分析服务返回的分析结构不符合要求，请稍后重试。",
  });
});

test("request gate blocks duplicate submissions while a request is running", () => {
  assert.equal(canStartAnalysisRequest(false), true);
  assert.equal(canStartAnalysisRequest(true), false);
});

test("successful reanalysis replaces the result and clears active error without resetting dock layout", () => {
  const previousState = {
    analysisResult: analysisA,
    activeErrorId: "错误 1",
    serverMessage: "旧错误",
    submitState: "success" as const,
    diagnosticLayoutVersion: 7,
  };

  const nextState = applyAnalysisSuccess(previousState, analysisB);

  assert.equal(nextState.analysisResult, analysisB);
  assert.equal(nextState.activeErrorId, null);
  assert.equal(nextState.serverMessage, "");
  assert.equal(nextState.submitState, "success");
  assert.equal(nextState.diagnosticLayoutVersion, 7);
});

test("failed reanalysis keeps the old result visible and allows retry", () => {
  const previousState = {
    analysisResult: analysisA,
    activeErrorId: "错误 1",
    serverMessage: "",
    submitState: "submitting" as const,
    diagnosticLayoutVersion: 3,
  };

  const nextState = applyAnalysisFailure(previousState, "请求失败");

  assert.equal(nextState.analysisResult, analysisA);
  assert.equal(nextState.activeErrorId, "错误 1");
  assert.equal(nextState.serverMessage, "请求失败");
  assert.equal(nextState.submitState, "error");
  assert.equal(nextState.diagnosticLayoutVersion, 3);
});
