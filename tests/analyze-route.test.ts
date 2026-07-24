import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import type { AnalysisResponse } from "../src/types/analysis";
import { POST } from "../src/app/api/analyze/route";
import {
  DeepSeekError,
  requestDeepSeekAnalysis,
} from "../src/lib/deepseek";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalDateNow = Date.now;
const originalNodeEnv = process.env.NODE_ENV;
const originalDeepSeekEndpoint = process.env.DEEPSEEK_API_ENDPOINT;
const originalDeepSeekModel = process.env.DEEPSEEK_MODEL;
const originalConsoleError = console.error;
const apiKey = "sk-secret-route-test";
const sensitiveUserCode = "int main(){return 0;} // USER_CODE_SHOULD_NOT_LEAK";

const validInput = {
  problem: "给定 n 个整数，输出最大值。",
  code: sensitiveUserCode,
  apiKey,
  userThought: "",
  failureInput: "",
  expectedOutput: "",
  actualOutput: "",
};

const validAnalysisResponse = {
  schemaVersion: "mvp-1",
  thoughtRestoration: {
    status: "insufficient_information",
    userThoughtSummary: "未提供用户思路，只能基于代码结构进行有限推断。",
    codeBehaviorSummary: "当前代码直接返回，没有读取输入或计算最大值。",
    consistencyAnalysis: "未提供用户思路，无法比较思路与代码是否一致。",
    deviationPoint: "代码尚未实现题目要求的输入、计算和输出流程。",
    canBeFixedAlongOriginalThought: false,
    reasoning: "现有信息不足以还原用户原思路。",
    confidence: "low",
  },
  blueBlocks: [],
  redErrors: [],
  redErrorsUnavailableReason: "",
  suspectedIssues: [],
  fixDirection: {
    personalizedPath: {
      strategy: "保留现有程序入口，补充读取、遍历和输出步骤。",
      steps: ["读取输入。", "遍历并维护最大值。", "输出结果。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <iostream>\nusing namespace std;\nint main(){int n,x;cin>>n>>x;int ans=x;while(--n){cin>>x;if(x>ans)ans=x;}cout<<ans;}",
        unavailableReason: "",
      },
      achievableLevel: "full_ac",
      limitations: ["依赖题目保证至少有一个输入整数。"],
    },
    standardPath: {
      strategy: "使用一次线性扫描维护当前最大值。",
      steps: ["读取首个元素初始化答案。", "扫描剩余元素并更新答案。", "输出答案。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <iostream>\nusing namespace std;\nint main(){int n,x;cin>>n>>x;int ans=x;while(--n){cin>>x;if(x>ans)ans=x;}cout<<ans;}",
        unavailableReason: "",
      },
      advantagesOverPersonalizedPath: ["步骤直接，容易复现。"],
    },
    newKnowledgeNeeded: [],
  },
  meta: {
    analysisBasis: ["problem", "code"],
    limitations: ["未实际运行或编译代码。", "未验证失败样例真实性。"],
    needsUserVerification: true,
  },
} satisfies AnalysisResponse;

beforeEach(() => {
  process.env.DEEPSEEK_API_ENDPOINT =
    "https://api.deepseek.com/chat/completions";
  process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  Date.now = originalDateNow;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalDeepSeekEndpoint === undefined) {
    delete process.env.DEEPSEEK_API_ENDPOINT;
  } else {
    process.env.DEEPSEEK_API_ENDPOINT = originalDeepSeekEndpoint;
  }
  if (originalDeepSeekModel === undefined) {
    delete process.env.DEEPSEEK_MODEL;
  } else {
    process.env.DEEPSEEK_MODEL = originalDeepSeekModel;
  }
  console.error = originalConsoleError;
});

function createRequest(
  body: unknown,
  sessionId?: string,
  cookieSessionId?: string,
) {
  const headers = new Headers({ "content-type": "application/json" });

  if (sessionId) {
    headers.set("x-analysis-session-id", sessionId);
  }

  if (cookieSessionId) {
    headers.set("cookie", `your-thinking-style-session=${cookieSessionId}`);
  }

  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function mockDeepSeekContent(content: string, finishReason = "stop") {
  const mock = mockDeepSeekResponses([{ content, finishReason }]);
  return mock.getCalls;
}

type MockDeepSeekResponse =
  | {
      content: string;
      finishReason?: string;
      status?: number;
      rawBody?: unknown;
    }
  | Error;

function mockDeepSeekResponses(responses: MockDeepSeekResponse[]) {
  const calls: RequestInit[] = [];

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {});
    const response = responses[Math.min(calls.length - 1, responses.length - 1)];

    if (response instanceof Error) {
      throw response;
    }

    if (response.status !== undefined && response.status >= 400) {
      return Response.json(
        { error: { message: "request failed" } },
        { status: response.status },
      );
    }

    if ("rawBody" in response) {
      if (typeof response.rawBody === "string") {
        return new Response(response.rawBody, {
          headers: { "content-type": "text/plain" },
        });
      }

      return Response.json(response.rawBody);
    }

    return Response.json({
      choices: [
        {
          finish_reason: response.finishReason ?? "stop",
          message: { content: response.content },
        },
      ],
    });
  };

  return {
    getCalls: () => calls.length,
    getRequestBodies: () =>
      calls.map((call) =>
        JSON.parse(String(call.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
          thinking?: { type?: string };
          reasoning_effort?: string;
        },
      ),
  };
}

function captureConsoleErrors() {
  const entries: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    entries.push(args);
  };
  return entries;
}

test("returns a valid structured analysis result", async () => {
  const getCalls = mockDeepSeekContent(JSON.stringify(validAnalysisResponse));

  const response = await POST(createRequest(validInput));
  const payload: unknown = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    success: true,
    data: validAnalysisResponse,
  });
  assert.equal(getCalls(), 1);
});

test("uses the configured DeepSeek V4 Pro model", async () => {
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(validInput));
  const requestBodies = mock.getRequestBodies();

  assert.equal(response.status, 200);
  assert.equal(requestBodies[0].model, "deepseek-v4-pro");
  assert.deepEqual(requestBodies[0].thinking, { type: "enabled" });
  assert.equal(requestBodies[0].reasoning_effort, "high");
});

test("classifies an abort while reading a successful DeepSeek response body as a timeout", async () => {
  globalThis.setTimeout = ((handler: TimerHandler) =>
    originalSetTimeout(handler, 1)) as typeof setTimeout;
  globalThis.fetch = async (_input, init) =>
    ({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    }) as Response;

  await assert.rejects(
    requestDeepSeekAnalysis("sk-redacted", "prompt", 5),
    (error: unknown) =>
      error instanceof DeepSeekError && error.code === "DEEPSEEK_TIMEOUT",
  );
});

test("returns a safe configuration error when production DeepSeek env is missing", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.DEEPSEEK_API_ENDPOINT;
  delete process.env.DEEPSEEK_MODEL;
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(validInput));
  const text = await response.text();
  const payload = JSON.parse(text);

  assert.equal(response.status, 500);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "DEEPSEEK_CONFIGURATION_ERROR");
  assert.equal(
    payload.error.message,
    "服务端 DeepSeek 配置缺失，请联系部署维护者。",
  );
  assert.equal(mock.getCalls(), 0);
  assert.equal(text.includes(apiKey), false);
  assert.equal(text.includes("Error:"), false);
  assert.equal(text.includes("stack"), false);
});

test("retries the full analysis once when the first JSON fails schema validation and the second passes", async () => {
  const supplementedInput = {
    ...validInput,
    userThought: "我想先排序再输出最大值。",
    failureInput: "3\n1 2 3",
    expectedOutput: "3",
    actualOutput: "1",
  };
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify({ schemaVersion: "mvp-1" }) },
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(supplementedInput));
  const payload: unknown = await response.json();
  const requestBodies = mock.getRequestBodies();
  const firstPrompt = requestBodies[0].messages.find(
    (message) => message.role === "user",
  )?.content;
  const secondPrompt = requestBodies[1].messages.find(
    (message) => message.role === "user",
  )?.content;

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    success: true,
    data: validAnalysisResponse,
  });
  assert.equal(mock.getCalls(), 2);
  assert.equal(secondPrompt, firstPrompt);
  assert.match(secondPrompt ?? "", /输出必须严格符合 analysisResponseSchema/);
  assert.match(secondPrompt ?? "", /"problem": "给定 n 个整数，输出最大值。"/);
  assert.match(secondPrompt ?? "", /USER_CODE_SHOULD_NOT_LEAK/);
  assert.match(secondPrompt ?? "", /我想先排序再输出最大值。/);
  assert.match(secondPrompt ?? "", /3\\n1 2 3/);
  assert.match(secondPrompt ?? "", /"expectedOutput": "3"/);
  assert.match(secondPrompt ?? "", /"actualOutput": "1"/);
});

test("shares one 270-second deadline across the initial analysis and schema retry", async () => {
  const nowValues = [0, 0, 0, 20_000, 20_000, 20_000, 20_000];
  let nowIndex = 0;
  Date.now = () =>
    nowValues[Math.min(nowIndex++, nowValues.length - 1)];
  const capturedTimeouts: number[] = [];
  globalThis.setTimeout = ((_handler: TimerHandler, timeout?: number) => {
    capturedTimeouts.push(Number(timeout));
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  mockDeepSeekResponses([
    { content: JSON.stringify({ schemaVersion: "mvp-1" }) },
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(
    createRequest(
      validInput,
      "12121212-1212-4212-8212-121212121212",
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedTimeouts, [270_000, 250_000]);
});

test("rejects invalid input without calling DeepSeek", async () => {
  const getCalls = mockDeepSeekContent(JSON.stringify(validAnalysisResponse));

  const response = await POST(
    createRequest({
      ...validInput,
      problem: " ",
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "INVALID_INPUT");
  assert.equal(getCalls(), 0);
});

test("retries once when the first model content is not valid JSON", async () => {
  const mock = mockDeepSeekResponses([
    { content: "not-json" },
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(mock.getCalls(), 2);
});

test("returns INVALID_MODEL_RESPONSE after two invalid JSON model responses", async () => {
  const mock = mockDeepSeekResponses([
    { content: "first-not-json" },
    { content: "second-not-json" },
  ]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "INVALID_MODEL_RESPONSE");
  assert.equal(mock.getCalls(), 2);
});

test("rejects a simultaneous analysis request for the same browser session", async () => {
  const sessionId = "55555555-5555-4555-8555-555555555555";
  let releaseFetch: (() => void) | undefined;
  const fetchStarted = new Promise<void>((resolve) => {
    globalThis.fetch = async () => {
      resolve();
      await new Promise<void>((release) => {
        releaseFetch = release;
      });
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(validAnalysisResponse) },
          },
        ],
      });
    };
  });

  const firstResponsePromise = POST(
    createRequest(validInput, sessionId),
  );
  await fetchStarted;

  const secondResponse = await POST(createRequest(validInput, sessionId));
  const secondPayload = await secondResponse.json();

  assert.equal(secondResponse.status, 409);
  assert.equal(secondPayload.error.code, "ANALYSIS_IN_PROGRESS");

  releaseFetch?.();
  const firstResponse = await firstResponsePromise;
  assert.equal(firstResponse.status, 200);
});

test("rejects the fourth analysis request in one minute for the same browser session", async () => {
  const sessionId = "66666666-6666-4666-8666-666666666666";
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  for (let index = 0; index < 3; index += 1) {
    const response = await POST(createRequest(validInput, sessionId));
    assert.equal(response.status, 200);
  }

  const response = await POST(createRequest(validInput, sessionId));
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(payload.error.code, "RATE_LIMIT_EXCEEDED");
  assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
  assert.equal(mock.getCalls(), 3);
});

test("keeps the existing cookie session limit after a page refresh changes the header id", async () => {
  const cookieSessionId = "77777777-7777-4777-8777-777777777777";
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  for (let index = 0; index < 3; index += 1) {
    const headerSessionId = `88888888-8888-4888-8888-88888888888${index}`;
    const response = await POST(
      createRequest(validInput, headerSessionId, cookieSessionId),
    );
    assert.equal(response.status, 200);
  }

  const response = await POST(
    createRequest(
      validInput,
      "99999999-9999-4999-8999-999999999999",
      cookieSessionId,
    ),
  );
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(payload.error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(mock.getCalls(), 3);
});

test("returns a clear error when DeepSeek returns a non-JSON HTTP body", async () => {
  const mock = mockDeepSeekResponses([{ content: "", rawBody: "not-json" }]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "DEEPSEEK_INVALID_RESPONSE");
  assert.equal(payload.error.message, "DeepSeek 返回内容无法解析，请稍后重试。");
  assert.equal(mock.getCalls(), 1);
});

test("returns EMPTY_MODEL_RESPONSE when DeepSeek returns no message content", async () => {
  const mock = mockDeepSeekResponses([
    { content: "", rawBody: { choices: [] } },
  ]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "EMPTY_MODEL_RESPONSE");
  assert.equal(payload.error.message, "DeepSeek 返回了空内容，请稍后重试。");
  assert.equal(mock.getCalls(), 1);
});

test("returns INVALID_MODEL_RESPONSE after two schema validation failures", async () => {
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify({ schemaVersion: "mvp-1" }) },
    { content: JSON.stringify({ schemaVersion: "mvp-1" }) },
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "INVALID_MODEL_RESPONSE");
  assert.equal(mock.getCalls(), 2);
});

test("retries an otherwise valid result when standardPath is missing", async () => {
  const withoutStandardPath = structuredClone(validAnalysisResponse);
  Reflect.deleteProperty(withoutStandardPath.fixDirection, "standardPath");
  const mock = mockDeepSeekResponses([
    { content: JSON.stringify(withoutStandardPath) },
    { content: JSON.stringify(validAnalysisResponse) },
  ]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(mock.getCalls(), 2);
});

test("never includes the API key in a success or failure response", async () => {
  mockDeepSeekContent(JSON.stringify(validAnalysisResponse));

  const successResponse = await POST(createRequest(validInput));
  const successText = await successResponse.text();

  mockDeepSeekContent("not-json");
  const failureResponse = await POST(createRequest(validInput));
  const failureText = await failureResponse.text();

  assert.equal(successText.includes(apiKey), false);
  assert.equal(failureText.includes(apiKey), false);
});

test("logs bounded JSON parse diagnostics only in development", async () => {
  process.env.NODE_ENV = "development";
  const content = `\`\`\`json\n${"x".repeat(120)}`;
  mockDeepSeekContent(content, "length");
  const logs = captureConsoleErrors();

  const response = await POST(createRequest(validInput));

  assert.equal(response.status, 502);
  assert.equal(logs.length, 4);
  assert.deepEqual(logs[0], ["[DeepSeek Analysis Validation]"]);
  assert.equal((logs[1][0] as { phase?: unknown }).phase, "json_parse");
  assert.equal((logs[1][0] as { retryTriggered?: unknown }).retryTriggered, true);
  assert.equal(typeof (logs[1][0] as { elapsedMs?: unknown }).elapsedMs, "number");
  assert.deepEqual(logs[2], ["[DeepSeek Analysis Validation]"]);
  assert.equal((logs[3][0] as { phase?: unknown }).phase, "json_parse");
  assert.equal((logs[3][0] as { retryTriggered?: unknown }).retryTriggered, false);

  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(apiKey), false);
  assert.equal(serializedLogs.includes(validInput.code), false);
  assert.equal(serializedLogs.includes(content), false);
  assert.equal(serializedLogs.includes(content.slice(0, 100)), false);
});

test("logs retry status and sanitized schema validation issues in development", async () => {
  process.env.NODE_ENV = "development";
  const invalidContent = JSON.stringify({
    schemaVersion: "mvp-1",
    meta: {
      analysisBasis: ["problem", "invalid_basis"],
      limitations: ["未实际运行代码。"],
      needsUserVerification: apiKey,
    },
  });
  mockDeepSeekResponses([
    { content: invalidContent, finishReason: "stop" },
    { content: JSON.stringify(validAnalysisResponse), finishReason: "stop" },
  ]);
  const logs = captureConsoleErrors();

  const response = await POST(createRequest(validInput));

  assert.equal(response.status, 200);
  assert.deepEqual(logs[0], ["[DeepSeek Analysis Validation]"]);
  assert.equal((logs[1][0] as { phase?: unknown }).phase, "schema_validation");
  assert.equal((logs[1][0] as { retryTriggered?: unknown }).retryTriggered, true);
  assert.equal(typeof (logs[1][0] as { elapsedMs?: unknown }).elapsedMs, "number");
  assert.ok(logs.length > 2);

  for (const [issue] of logs.slice(2)) {
    assert.equal(typeof issue, "object");
    assert.notEqual(issue, null);
    assert.ok("path" in issue);
    assert.ok("code" in issue);
    assert.ok("message" in issue);
    assert.ok("actualType" in issue);
    assert.ok("summary" in issue);
    assert.equal(typeof (issue as { path: unknown }).path, "string");
    assert.equal(typeof (issue as { code: unknown }).code, "string");
    assert.equal(typeof (issue as { message: unknown }).message, "string");
    assert.equal(typeof (issue as { actualType: unknown }).actualType, "string");
    assert.equal(typeof (issue as { summary: unknown }).summary, "string");
  }

  assert.ok(
    logs
      .slice(2)
      .some(
        ([issue]) =>
          (issue as { path?: unknown }).path === "meta.analysisBasis.1" &&
          Array.isArray((issue as { values?: unknown }).values),
      ),
  );
  assert.ok(
    logs
      .slice(2)
      .some(
        ([issue]) =>
          (issue as { path?: unknown }).path ===
            "meta.needsUserVerification" &&
          (issue as { expected?: unknown }).expected === "boolean" &&
          (issue as { actualType?: unknown }).actualType === "string" &&
          (issue as { summary?: unknown }).summary ===
            `string(length=${apiKey.length})`,
      ),
  );

  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(apiKey), false);
  assert.equal(serializedLogs.includes(validInput.code), false);
  assert.equal(serializedLogs.includes(invalidContent), false);
});

test("logs sanitized personalized reference code diagnostics in development", async () => {
  process.env.NODE_ENV = "development";
  const invalidResponse = structuredClone(validAnalysisResponse);
  const sensitiveModelCode = "MODEL_CODE_SHOULD_NOT_BE_LOGGED";
  const sensitiveUnavailableReason = "REASON_SHOULD_NOT_BE_LOGGED";
  invalidResponse.fixDirection.personalizedPath.achievableLevel = "full_ac";
  invalidResponse.fixDirection.personalizedPath.referenceCode = {
    available: true,
    codeType: "partial_code",
    language: "cpp",
    code: sensitiveModelCode,
    unavailableReason: sensitiveUnavailableReason,
  };
  const invalidContent = JSON.stringify(invalidResponse);
  mockDeepSeekResponses([
    { content: invalidContent, finishReason: "stop" },
    { content: JSON.stringify(validAnalysisResponse), finishReason: "stop" },
  ]);
  const logs = captureConsoleErrors();

  const response = await POST(createRequest(validInput));

  assert.equal(response.status, 200);
  assert.ok(
    logs.some(
      ([entry]) =>
        typeof entry === "object" &&
        entry !== null &&
        "personalizedPath.achievableLevel" in entry,
    ),
  );

  const diagnostic = logs
    .map(([entry]) => entry)
    .find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "personalizedPath.achievableLevel" in entry,
    );

  assert.deepEqual(diagnostic, {
    "personalizedPath.achievableLevel": "full_ac",
    "referenceCode.available": true,
    "referenceCode.codeType": "partial_code",
    "referenceCode.language": "cpp",
    "referenceCode.codeLength": sensitiveModelCode.length,
    "referenceCode.unavailableReasonLength": sensitiveUnavailableReason.length,
  });

  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(sensitiveModelCode), false);
  assert.equal(serializedLogs.includes(sensitiveUnavailableReason), false);
  assert.equal(serializedLogs.includes(apiKey), false);
  assert.equal(serializedLogs.includes(validInput.problem), false);
  assert.equal(serializedLogs.includes(validInput.code), false);
});

test("does not log model diagnostics outside development", async () => {
  process.env.NODE_ENV = "production";
  mockDeepSeekContent("not-json", "stop");
  const logs = captureConsoleErrors();

  const response = await POST(createRequest(validInput));

  assert.equal(response.status, 502);
  assert.deepEqual(logs, []);
});

test("does not retry DeepSeek network failures", async () => {
  const mock = mockDeepSeekResponses([new TypeError("network down")]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "DEEPSEEK_REQUEST_FAILED");
  assert.equal(mock.getCalls(), 1);
});

test("does not retry DeepSeek authentication failures", async () => {
  const mock = mockDeepSeekResponses([{ content: "", status: 401 }]);

  const response = await POST(createRequest(validInput));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "DEEPSEEK_REQUEST_FAILED");
  assert.equal(mock.getCalls(), 1);
});
