import test from "node:test";
import assert from "node:assert/strict";

import { analysisResponseSchema } from "./analysis-response";
import {
  parseAnalysisResponse,
  validateCodeLocation,
} from "../lib/analysis-validation";

const validAnalysisResponse = {
  schemaVersion: "mvp-1",
  thoughtRestoration: {
    status: "implementation_bug",
    userThoughtSummary: "用户希望遍历数组并记录最大值。",
    codeBehaviorSummary: "代码遍历了数组，但最大值初始值不适用于全负数。",
    consistencyAnalysis: "整体实现与描述一致，初始化细节偏离了目标。",
    deviationPoint: "最大值被固定初始化为 0。",
    canBeFixedAlongOriginalThought: true,
    reasoning: "遍历策略可行，只需修正初始化。",
    confidence: "high",
  },
  blueBlocks: [
    {
      location: {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 13,
        exactCode: "int main() {",
      },
      reason: "程序入口包含核心遍历流程。",
    },
  ],
  redErrors: [
    {
      id: "错误 1",
      location: {
        startLine: 2,
        startColumn: 3,
        endLine: 2,
        endColumn: 13,
        exactCode: "int x = 0;",
      },
      errorType: "logic_error",
      evidenceLevel: "confirmed",
      evidenceSources: ["failure_case", "static_analysis"],
      title: "最大值初始化错误",
      explanation: "当所有输入都为负数时，0 不属于输入且会覆盖真实最大值。",
      runtimeConsequence: "全负数输入会错误输出 0。",
      localFixSuggestion: "使用首个输入值初始化最大值。",
    },
  ],
  redErrorsUnavailableReason: "",
  suspectedIssues: [
    {
      title: "空输入处理需要确认",
      evidenceSource: "insufficient_evidence",
      explanation: "题面片段未明确数组是否可能为空。",
      suggestedVerification: "核对题目约束中的 n 最小值。",
    },
  ],
  fixDirection: {
    personalizedPath: {
      strategy: "保留线性遍历，只修正最大值初始化。",
      steps: ["读取第一个元素作为初始最大值。", "遍历剩余元素并更新最大值。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <iostream>\nusing namespace std;\nint main(){int n,x;cin>>n>>x;int ans=x;while(--n){cin>>x;if(x>ans)ans=x;}cout<<ans;}",
        unavailableReason: "",
      },
      achievableLevel: "full_ac",
      limitations: [],
    },
    standardPath: {
      strategy: "使用标准线性扫描求最大值。",
      steps: ["读取数组。", "从首元素开始维护当前最大值。", "输出最终最大值。"],
      keyAlgorithmOrDataStructure: "线性扫描",
      referenceCode: {
        available: true,
        codeType: "full_code",
        language: "cpp",
        code: "#include <algorithm>\n#include <iostream>\n#include <vector>\nusing namespace std;\nint main(){int n;cin>>n;vector<int>a(n);for(int&x:a)cin>>x;cout<<*max_element(a.begin(),a.end());}",
        unavailableReason: "",
      },
      advantagesOverPersonalizedPath: ["表达更直接。", "复用标准库并减少手写判断。"],
    },
    newKnowledgeNeeded: [
      {
        topic: "std::max_element",
        whyNeeded: "标准路径使用它查找区间最大值。",
        usedInPath: ["standardPath"],
        minimumExplanation: "它返回指定迭代器区间中最大元素的位置。",
      },
    ],
  },
  meta: {
    analysisBasis: ["problem", "code", "user_thought", "failure_case"],
    limitations: ["未实际运行代码。", "失败样例真实性未验证。"],
    needsUserVerification: true,
  },
};

function cloneValidResponse() {
  return structuredClone(validAnalysisResponse);
}

function assertSchemaFailure(input: unknown) {
  const result = analysisResponseSchema.safeParse(input);
  assert.equal(result.success, false);
}

function assertSchemaIssue(
  input: unknown,
  expectedPath: Array<string | number>,
  expectedCode?: string,
) {
  const result = analysisResponseSchema.safeParse(input);
  assert.equal(result.success, false);

  if (!result.success) {
    const issue = result.error.issues.find(
      (candidate) =>
        candidate.path.length === expectedPath.length &&
        candidate.path.every(
          (segment, index) => segment === expectedPath[index],
        ) &&
        (expectedCode === undefined || candidate.code === expectedCode),
    );

    assert.ok(
      issue,
      `Expected issue at ${expectedPath.join(".")}${
        expectedCode ? ` with code ${expectedCode}` : ""
      }, received ${JSON.stringify(
        result.error.issues.map(({ path, code }) => ({ path, code })),
      )}`,
    );
  }
}

test("accepts a complete valid analysis response", () => {
  const result = analysisResponseSchema.safeParse(validAnalysisResponse);

  assert.equal(result.success, true);
});

test("parseAnalysisResponse returns narrowed data on success", () => {
  const result = parseAnalysisResponse(validAnalysisResponse);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.schemaVersion, "mvp-1");
    assert.notEqual(result.data, validAnalysisResponse);
  }
});

test("parseAnalysisResponse returns structured issues without raw input", () => {
  const invalid = cloneValidResponse();
  invalid.schemaVersion = "mvp-2";

  const result = parseAnalysisResponse(invalid);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.length > 0);
    assert.deepEqual(result.issues[0]?.path, ["schemaVersion"]);
    assert.equal(typeof result.issues[0]?.code, "string");
    assert.equal(typeof result.issues[0]?.message, "string");
    assert.equal("input" in result, false);
  }
});

test("rejects a missing required top-level field", () => {
  const invalid = cloneValidResponse();
  Reflect.deleteProperty(invalid, "meta");

  assertSchemaFailure(invalid);
});

test("rejects an unknown top-level field", () => {
  const invalid = { ...cloneValidResponse(), extra: true };

  assertSchemaFailure(invalid);
});

test("rejects an unknown field in thoughtRestoration", () => {
  const invalid = cloneValidResponse();
  Object.assign(invalid.thoughtRestoration, { extraField: true });

  assertSchemaIssue(invalid, ["thoughtRestoration"], "unrecognized_keys");
});

test("rejects an unknown field in standardPath referenceCode", () => {
  const invalid = cloneValidResponse();
  Object.assign(invalid.fixDirection.standardPath.referenceCode, {
    extraField: true,
  });

  assertSchemaIssue(
    invalid,
    ["fixDirection", "standardPath", "referenceCode"],
    "unrecognized_keys",
  );
});

test("rejects a schemaVersion other than mvp-1", () => {
  const invalid = cloneValidResponse();
  invalid.schemaVersion = "mvp-2";

  assertSchemaFailure(invalid);
});

test("rejects more than three blue blocks", () => {
  const invalid = cloneValidResponse();
  invalid.blueBlocks = Array.from({ length: 4 }, () =>
    structuredClone(validAnalysisResponse.blueBlocks[0]),
  );

  assertSchemaFailure(invalid);
});

test("rejects more than five red errors", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors = Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(validAnalysisResponse.redErrors[0]),
    id: `错误 ${Math.min(index + 1, 5)}`,
  }));

  assertSchemaIssue(invalid, ["redErrors"], "too_big");
});

test("rejects invalid enum values", () => {
  const invalid = cloneValidResponse();
  invalid.thoughtRestoration.status = "unknown_status";

  assertSchemaFailure(invalid);
});

test("rejects non-contiguous red error ids", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors.push({
    ...structuredClone(validAnalysisResponse.redErrors[0]),
    id: "错误 3",
  });

  assertSchemaFailure(invalid);
});

test("rejects duplicate red error ids", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors.push(structuredClone(validAnalysisResponse.redErrors[0]));

  assertSchemaFailure(invalid);
});

test("rejects a red error evidence level other than confirmed", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors[0].evidenceLevel = "suspected";

  assertSchemaFailure(invalid);
});

test("rejects empty red error evidence sources", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors[0].evidenceSources = [];

  assertSchemaFailure(invalid);
});

test("rejects duplicate red error evidence sources", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors[0].evidenceSources = [
    "static_analysis",
    "static_analysis",
  ];

  assertSchemaFailure(invalid);
});

test("rejects invalid red error evidence sources", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors[0].evidenceSources = ["model_guess"];

  assertSchemaFailure(invalid);
});

test("requires a reason when implementation_bug has no red errors", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors = [];
  invalid.redErrorsUnavailableReason = "   ";

  assertSchemaFailure(invalid);
});

test("accepts a reason when implementation_bug has no red errors", () => {
  const valid = cloneValidResponse();
  valid.redErrors = [];
  valid.redErrorsUnavailableReason = "无法可靠定位到单一连续代码范围。";

  assert.equal(analysisResponseSchema.safeParse(valid).success, true);
});

test("accepts full_ac with available full C++ code", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "full_ac";

  const result = analysisResponseSchema.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.fixDirection.personalizedPath.referenceCode, {
      available: true,
      codeType: "full_code",
      language: "cpp",
      code: valid.fixDirection.personalizedPath.referenceCode.code,
      unavailableReason: "",
    });
  }
});

test("accepts full_ac_non_optimal with available full C++ code", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "full_ac_non_optimal";

  const result = analysisResponseSchema.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(
      result.data.fixDirection.personalizedPath.achievableLevel,
      "full_ac_non_optimal",
    );
    assert.equal(
      result.data.fixDirection.personalizedPath.referenceCode.codeType,
      "full_code",
    );
  }
});

test("accepts partial_data with available partial C++ code", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "partial_data";
  valid.fixDirection.personalizedPath.referenceCode.codeType = "partial_code";
  valid.fixDirection.personalizedPath.referenceCode.code =
    "int ans = *max_element(a.begin(), a.end());";

  const result = analysisResponseSchema.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(
      result.data.fixDirection.personalizedPath.referenceCode.codeType,
      "partial_code",
    );
    assert.equal(
      result.data.fixDirection.personalizedPath.referenceCode.language,
      "cpp",
    );
  }
});

test("accepts partial_data with available full C++ code", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "partial_data";

  const result = analysisResponseSchema.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(
      result.data.fixDirection.personalizedPath.referenceCode.codeType,
      "full_code",
    );
    assert.equal(
      result.data.fixDirection.personalizedPath.referenceCode.language,
      "cpp",
    );
  }
});

test("accepts understanding_only with available pseudocode", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "understanding_only";
  valid.fixDirection.personalizedPath.referenceCode = {
    available: true,
    codeType: "pseudocode",
    language: "pseudo",
    code: "读取首元素作为最大值，再扫描剩余元素",
    unavailableReason: "",
  };

  const result = analysisResponseSchema.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.fixDirection.personalizedPath.referenceCode, {
      available: true,
      codeType: "pseudocode",
      language: "pseudo",
      code: "读取首元素作为最大值，再扫描剩余元素",
      unavailableReason: "",
    });
  }
});

test("rejects partial code for a full_ac personalized path", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.personalizedPath.referenceCode.codeType = "partial_code";

  assertSchemaFailure(invalid);
});

test("rejects pseudocode for a partial_data personalized path", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.personalizedPath.achievableLevel = "partial_data";
  invalid.fixDirection.personalizedPath.referenceCode = {
    available: true,
    codeType: "pseudocode",
    language: "pseudo",
    code: "扫描并维护最大值",
    unavailableReason: "",
  };

  assertSchemaFailure(invalid);
});

test("accepts unavailable reference code for understanding_only with a reason", () => {
  const valid = cloneValidResponse();
  valid.fixDirection.personalizedPath.achievableLevel = "understanding_only";
  valid.fixDirection.personalizedPath.referenceCode = {
    available: false,
    codeType: "pseudocode",
    language: "pseudo",
    code: "",
    unavailableReason: "当前信息不足以提供可靠代码。",
  };

  assert.equal(analysisResponseSchema.safeParse(valid).success, true);
});

test("rejects available reference code with blank code", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.personalizedPath.referenceCode.code = "   ";

  assertSchemaFailure(invalid);
});

test("rejects unavailable reference code with a blank reason", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.personalizedPath.achievableLevel = "understanding_only";
  invalid.fixDirection.personalizedPath.referenceCode = {
    available: false,
    codeType: "pseudocode",
    language: "pseudo",
    code: "",
    unavailableReason: "   ",
  };

  assertSchemaFailure(invalid);
});

test("rejects pseudocode in the standard path", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.standardPath.referenceCode = {
    available: true,
    codeType: "pseudocode",
    language: "pseudo",
    code: "扫描数组",
    unavailableReason: "",
  };

  assertSchemaFailure(invalid);
});

test("rejects partial code in the standard path", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.standardPath.referenceCode.codeType = "partial_code";

  assertSchemaFailure(invalid);
});

test("rejects blank code in the standard path", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.standardPath.referenceCode.code = "\n\t";

  assertSchemaFailure(invalid);
});

test("rejects unavailable reference code in the standard path even with a reason", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.standardPath.referenceCode.available = false;
  invalid.fixDirection.standardPath.referenceCode.unavailableReason =
    "模型无法提供代码。";

  assertSchemaIssue(invalid, [
    "fixDirection",
    "standardPath",
    "referenceCode",
  ]);
});

test("rejects duplicate new knowledge topics after trimming", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.newKnowledgeNeeded.push({
    ...structuredClone(validAnalysisResponse.fixDirection.newKnowledgeNeeded[0]),
    topic: "  std::max_element  ",
  });

  assertSchemaFailure(invalid);
});

test("rejects duplicate usedInPath values", () => {
  const invalid = cloneValidResponse();
  invalid.fixDirection.newKnowledgeNeeded[0].usedInPath = [
    "standardPath",
    "standardPath",
  ];

  assertSchemaFailure(invalid);
});

test("rejects duplicate analysisBasis values", () => {
  const invalid = cloneValidResponse();
  invalid.meta.analysisBasis = ["problem", "code", "code"];

  assertSchemaFailure(invalid);
});

test("rejects critical explanatory strings containing only whitespace", () => {
  const invalid = cloneValidResponse();
  invalid.redErrors[0].explanation = " \n\t ";

  assertSchemaFailure(invalid);
});

test("rejects a zero-length same-line Monaco range", () => {
  const invalid = cloneValidResponse();
  invalid.blueBlocks[0].location.endColumn =
    invalid.blueBlocks[0].location.startColumn;

  assertSchemaFailure(invalid);
});

test("rejects a Monaco range ending before it starts", () => {
  const invalid = cloneValidResponse();
  invalid.blueBlocks[0].location.startLine = 3;
  invalid.blueBlocks[0].location.endLine = 2;

  assertSchemaFailure(invalid);
});

test("accepts a valid cross-line Monaco range", () => {
  const valid = cloneValidResponse();
  valid.blueBlocks[0].location = {
    startLine: 1,
    startColumn: 5,
    endLine: 2,
    endColumn: 4,
    exactCode: "main() {\n  i",
  };

  assert.equal(analysisResponseSchema.safeParse(valid).success, true);
});

test("preserves a whitespace-only exactCode without trimming", () => {
  const valid = cloneValidResponse();
  valid.blueBlocks[0].location.exactCode = "   ";

  const result = parseAnalysisResponse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    const exactCode = result.data.blueBlocks[0].location.exactCode;
    assert.equal(exactCode, "   ");
    assert.equal(exactCode.length, 3);
  }
});

test("validateCodeLocation accepts an exact matching range", () => {
  const sourceCode = "int main() {\n  int x = 0;\n  return x;\n}";

  const result = validateCodeLocation(
    validAnalysisResponse.redErrors[0].location,
    sourceCode,
  );

  assert.deepEqual(result, {
    success: true,
    extractedCode: "int x = 0;",
  });
});

test("validateCodeLocation reports exact code mismatch", () => {
  const location = {
    ...validAnalysisResponse.redErrors[0].location,
    exactCode: "int x = 1;",
  };

  const result = validateCodeLocation(
    location,
    "int main() {\n  int x = 0;\n}",
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "exact_code_mismatch");
  }
});

test("validateCodeLocation reports line out of bounds", () => {
  const location = {
    ...validAnalysisResponse.redErrors[0].location,
    startLine: 5,
    endLine: 5,
  };

  const result = validateCodeLocation(location, "int main() {}");

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "line_out_of_bounds");
  }
});

test("validateCodeLocation reports column out of bounds", () => {
  const location = {
    ...validAnalysisResponse.redErrors[0].location,
    startLine: 1,
    endLine: 1,
    startColumn: 20,
    endColumn: 21,
  };

  const result = validateCodeLocation(location, "short");

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.reason, "column_out_of_bounds");
  }
});

test("validateCodeLocation reports invalid ranges and non-string source code", () => {
  const reversed = {
    ...validAnalysisResponse.redErrors[0].location,
    startColumn: 5,
    endColumn: 5,
  };

  const invalidRange = validateCodeLocation(reversed, "abcdef");
  const invalidSource = validateCodeLocation(
    validAnalysisResponse.redErrors[0].location,
    null,
  );

  assert.equal(invalidRange.success, false);
  assert.equal(invalidSource.success, false);
  if (!invalidRange.success && !invalidSource.success) {
    assert.equal(invalidRange.reason, "invalid_range");
    assert.equal(invalidSource.reason, "invalid_source_code");
  }
});

test("validateCodeLocation handles LF cross-line ranges", () => {
  const result = validateCodeLocation(
    {
      startLine: 1,
      startColumn: 2,
      endLine: 2,
      endColumn: 3,
      exactCode: "bc\nde",
    },
    "abc\ndef",
  );

  assert.equal(result.success, true);
});

test("validateCodeLocation handles CRLF without counting carriage return as a column", () => {
  const result = validateCodeLocation(
    {
      startLine: 1,
      startColumn: 2,
      endLine: 2,
      endColumn: 3,
      exactCode: "bc\r\nde",
    },
    "abc\r\ndef",
  );

  assert.equal(result.success, true);
});
