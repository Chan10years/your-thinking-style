import test from "node:test";
import assert from "node:assert/strict";

import {
  INPUT_LIMITS,
  validateAnalysisInput,
  type AnalysisInput,
} from "../src/lib/input-validation.ts";

const validInput: AnalysisInput = {
  problem: "给定 n 个数，求它们的最大值。",
  code: "#include <bits/stdc++.h>\nusing namespace std;\nint main(){return 0;}",
  apiKey: "sk-valid",
  userThought: "",
  failureInput: "",
  expectedOutput: "",
  actualOutput: "",
};

test("accepts required fields with optional supplemental fields empty", () => {
  const result = validateAnalysisInput(validInput);

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test("requires problem, C++ code, and API key after trimming whitespace", () => {
  const result = validateAnalysisInput({
    ...validInput,
    problem: "   ",
    code: "\n\t",
    apiKey: "",
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.problem, "请填写算法题目。");
  assert.equal(result.errors.code, "请填写 C++ 代码。");
  assert.equal(result.errors.apiKey, "请填写 DeepSeek API Key。");
});

test("rejects every field that exceeds the MVP length limit", () => {
  const result = validateAnalysisInput({
    problem: "题".repeat(INPUT_LIMITS.problem + 1),
    code: "a".repeat(INPUT_LIMITS.code + 1),
    apiKey: "sk-valid",
    userThought: "想".repeat(INPUT_LIMITS.userThought + 1),
    failureInput: "1".repeat(INPUT_LIMITS.failureInput + 1),
    expectedOutput: "2".repeat(INPUT_LIMITS.expectedOutput + 1),
    actualOutput: "3".repeat(INPUT_LIMITS.actualOutput + 1),
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.problem, "题目不能超过 6000 字。");
  assert.equal(result.errors.code, "C++ 代码不能超过 12000 字。");
  assert.equal(result.errors.userThought, "我的思路或卡点不能超过 800 字。");
  assert.equal(result.errors.failureInput, "失败输入不能超过 2000 字。");
  assert.equal(result.errors.expectedOutput, "预期输出不能超过 1000 字。");
  assert.equal(result.errors.actualOutput, "实际输出或报错不能超过 2000 字。");
});

test("allows fields exactly at the MVP length limits", () => {
  const result = validateAnalysisInput({
    problem: "题".repeat(INPUT_LIMITS.problem),
    code: "a".repeat(INPUT_LIMITS.code),
    apiKey: "sk-valid",
    userThought: "想".repeat(INPUT_LIMITS.userThought),
    failureInput: "1".repeat(INPUT_LIMITS.failureInput),
    expectedOutput: "2".repeat(INPUT_LIMITS.expectedOutput),
    actualOutput: "3".repeat(INPUT_LIMITS.actualOutput),
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});
