import assert from "node:assert/strict";
import test from "node:test";

import { buildAnalysisPrompt } from "../src/lib/build-analysis-prompt";
import { analysisResponseSchema } from "../src/schemas/analysis-response";

const prompt = buildAnalysisPrompt({
  problem: "给定 n 个整数，输出最大值。",
  code: "int main(){return 0;}",
  userThought: "",
  failureInput: "",
  expectedOutput: "",
  actualOutput: "",
});

test("includes every required redError field in the JSON template", () => {
  const requiredFields = [
    '"id": "错误 1"',
    '"location"',
    '"errorType"',
    '"evidenceLevel": "confirmed"',
    '"evidenceSources"',
    '"title"',
    '"explanation"',
    '"runtimeConsequence"',
    '"localFixSuggestion"',
  ];

  for (const field of requiredFields) {
    assert.ok(prompt.includes(field), `Prompt should include ${field}`);
  }
});

test("lists all five legal red error ids", () => {
  for (let index = 1; index <= 5; index += 1) {
    assert.ok(prompt.includes(`“错误 ${index}”`));
  }
});

test("forbids reason on redError and all extra strict-object fields", () => {
  assert.match(prompt, /redError[^。]*严禁[^。]*reason/);
  assert.match(prompt, /strict[^。]*不能出现额外键/);
  assert.match(prompt, /严禁创建模板之外的字段/);
});

test("states every achievableLevel constraint and the full_ac code requirement", () => {
  for (const level of [
    "understanding_only",
    "partial_data",
    "full_ac_non_optimal",
    "full_ac",
  ]) {
    assert.ok(prompt.includes(level));
  }

  assert.match(
    prompt,
    /full_ac[^。]*完整、非空、可以独立复现的 C\+\+ 程序/,
  );
  assert.match(prompt, /只能提供局部代码[^。]*不得声明为 full_ac/);
});

test("requires standardPath and preserves exactCode verbatim", () => {
  assert.match(prompt, /standardPath 永远必须提供/);
  assert.match(prompt, /exactCode[^。]*逐字引用[^。]*空格和换行不能自行改写/);
});

test("contains a complete JSON template accepted by analysisResponseSchema", () => {
  const start = prompt.indexOf('{\n  "schemaVersion"');
  const end = prompt.indexOf("\n\n枚举和结构规则：", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const template: unknown = JSON.parse(prompt.slice(start, end));
  const result = analysisResponseSchema.safeParse(template);

  assert.equal(
    result.success,
    true,
    result.success ? undefined : JSON.stringify(result.error.issues),
  );
});
