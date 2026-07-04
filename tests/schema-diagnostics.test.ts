import assert from "node:assert/strict";
import test from "node:test";

import { analysisResponseSchema } from "../src/schemas/analysis-response";
import { formatSchemaValidationIssues } from "../src/lib/schema-diagnostics";

const sensitiveText = "SK_SECRET_AND_USER_CODE_SHOULD_NOT_LEAK";

const baseResponse = {
  schemaVersion: "mvp-1",
  thoughtRestoration: {
    status: "implementation_bug",
    userThoughtSummary: "未提供用户思路。",
    codeBehaviorSummary: "代码直接返回。",
    consistencyAnalysis: "信息不足。",
    deviationPoint: "",
    canBeFixedAlongOriginalThought: false,
    reasoning: "只能基于静态结构判断。",
    confidence: "low",
  },
  blueBlocks: [],
  redErrors: [],
  redErrorsUnavailableReason: "无法可靠定位具体错误。",
  suspectedIssues: [],
  fixDirection: {
    personalizedPath: {
      strategy: "补充完整实现。",
      steps: ["读取输入。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <iostream>\nint main(){return 0;}",
        unavailableReason: "",
      },
      achievableLevel: "full_ac",
      limitations: [],
    },
    standardPath: {
      strategy: "使用标准线性扫描。",
      steps: ["读取输入。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <iostream>\nint main(){return 0;}",
        unavailableReason: "",
      },
      advantagesOverPersonalizedPath: ["更直接。"],
    },
    newKnowledgeNeeded: [],
  },
  meta: {
    analysisBasis: ["problem", "code"],
    limitations: ["未实际运行、编译或判题。"],
    needsUserVerification: true,
  },
};

function schemaIssuesFor(input: unknown) {
  const result = analysisResponseSchema.safeParse(input);
  assert.equal(result.success, false);

  if (result.success) {
    throw new Error("expected schema validation to fail");
  }

  return result.error.issues;
}

test("formats nested path issues with expected type and actual safe summary", () => {
  const input = structuredClone(baseResponse);
  input.fixDirection.standardPath.referenceCode.code = [sensitiveText];

  const diagnostics = formatSchemaValidationIssues(
    schemaIssuesFor(input),
    input,
  );

  assert.deepEqual(
    diagnostics.find(
      (diagnostic) =>
        diagnostic.path === "fixDirection.standardPath.referenceCode.code",
    ),
    {
      path: "fixDirection.standardPath.referenceCode.code",
      code: "invalid_type",
      message: "Invalid input: expected string, received array",
      expected: "string",
      actualType: "array",
      summary: "array(length=1)",
    },
  );

  assert.equal(JSON.stringify(diagnostics).includes(sensitiveText), false);
});

test("includes legal values and whitelisted actual enum strings", () => {
  const input = structuredClone(baseResponse);
  input.thoughtRestoration.status = "model_guess";

  const diagnostics = formatSchemaValidationIssues(
    schemaIssuesFor(input),
    input,
  );

  assert.deepEqual(
    diagnostics.find(
      (diagnostic) => diagnostic.path === "thoughtRestoration.status",
    ),
    {
      path: "thoughtRestoration.status",
      code: "invalid_value",
      message:
        'Invalid option: expected one of "thought_flawed"|"implementation_bug"|"thought_code_mismatch"|"insufficient_information"',
      values: [
        "thought_flawed",
        "implementation_bug",
        "thought_code_mismatch",
        "insufficient_information",
      ],
      actualType: "string",
      summary: 'string(length=11, value="model_guess")',
    },
  );
});

test("redacts non-enum string values from actual summaries", () => {
  const input = structuredClone(baseResponse);
  input.meta.needsUserVerification = sensitiveText;

  const diagnostics = formatSchemaValidationIssues(
    schemaIssuesFor(input),
    input,
  );

  assert.deepEqual(
    diagnostics.find(
      (diagnostic) => diagnostic.path === "meta.needsUserVerification",
    ),
    {
      path: "meta.needsUserVerification",
      code: "invalid_type",
      message: "Invalid input: expected boolean, received string",
      expected: "boolean",
      actualType: "string",
      summary: `string(length=${sensitiveText.length})`,
    },
  );

  assert.equal(JSON.stringify(diagnostics).includes(sensitiveText), false);
});

test("summarizes null, undefined, numbers, booleans, arrays, and objects without values", () => {
  const input = structuredClone(baseResponse);
  Reflect.deleteProperty(input, "meta");
  input.redErrorsUnavailableReason = null;
  input.thoughtRestoration.canBeFixedAlongOriginalThought = 1;
  input.thoughtRestoration.reasoning = false;
  input.fixDirection.standardPath.referenceCode = {
    available: true,
    codeType: "full_code",
    language: "cpp",
    code: sensitiveText,
    unavailableReason: "",
  };
  input.suspectedIssues = {};

  const diagnostics = formatSchemaValidationIssues(
    schemaIssuesFor(input),
    input,
  );

  assert.equal(
    diagnostics.find((diagnostic) => diagnostic.path === "meta")?.summary,
    "undefined",
  );
  assert.equal(
    diagnostics.find(
      (diagnostic) => diagnostic.path === "redErrorsUnavailableReason",
    )?.summary,
    "null",
  );
  assert.equal(
    diagnostics.find(
      (diagnostic) =>
        diagnostic.path ===
        "thoughtRestoration.canBeFixedAlongOriginalThought",
    )?.summary,
    "number",
  );
  assert.equal(
    diagnostics.find(
      (diagnostic) => diagnostic.path === "thoughtRestoration.reasoning",
    )?.summary,
    "boolean",
  );
  assert.equal(
    diagnostics.find((diagnostic) => diagnostic.path === "suspectedIssues")
      ?.summary,
    "object(keys=)",
  );
  assert.equal(JSON.stringify(diagnostics).includes(sensitiveText), false);
});
