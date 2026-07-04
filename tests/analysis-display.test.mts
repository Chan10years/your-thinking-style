import assert from "node:assert/strict";
import test from "node:test";

import {
  getAchievableLevelLabel,
  getAnalysisBasisLabel,
  getConfidenceLabel,
  getEvidenceSourceLabel,
  getRedErrorTypeLabel,
  getThoughtStatusLabel,
} from "../src/lib/analysis-display";

test("maps thought restoration status labels", () => {
  assert.equal(getThoughtStatusLabel("thought_flawed"), "思路本身有问题");
  assert.equal(
    getThoughtStatusLabel("implementation_bug"),
    "思路大体可行，实现出现错误",
  );
  assert.equal(
    getThoughtStatusLabel("thought_code_mismatch"),
    "用户描述的思路与代码实现不一致",
  );
  assert.equal(
    getThoughtStatusLabel("insufficient_information"),
    "信息不足，无法可靠判断用户思路",
  );
});

test("maps evidence and metadata labels", () => {
  assert.equal(getEvidenceSourceLabel("failure_case"), "失败样例支持");
  assert.equal(getEvidenceSourceLabel("static_analysis"), "静态分析");
  assert.equal(getEvidenceSourceLabel("insufficient_evidence"), "证据不足");
  assert.equal(getAnalysisBasisLabel("problem"), "题目");
  assert.equal(getAnalysisBasisLabel("code"), "代码");
  assert.equal(getAnalysisBasisLabel("user_thought"), "用户思路");
  assert.equal(getAnalysisBasisLabel("failure_case"), "失败信息");
});

test("maps fix path labels", () => {
  assert.equal(getConfidenceLabel("high"), "高");
  assert.equal(getConfidenceLabel("medium"), "中");
  assert.equal(getConfidenceLabel("low"), "低");
  assert.equal(getAchievableLevelLabel("understanding_only"), "只能帮助理解");
  assert.equal(getAchievableLevelLabel("partial_data"), "只能通过部分数据");
  assert.equal(
    getAchievableLevelLabel("full_ac_non_optimal"),
    "可以完整通过，但不是最优",
  );
  assert.equal(getAchievableLevelLabel("full_ac"), "可以完整通过");
});

test("maps red error type labels", () => {
  assert.equal(
    getRedErrorTypeLabel("syntax_or_compile_error"),
    "语法或编译级错误",
  );
  assert.equal(
    getRedErrorTypeLabel("hard_requirement_violation"),
    "题意硬约束违背",
  );
  assert.equal(getRedErrorTypeLabel("boundary_case_error"), "边界条件必错");
  assert.equal(getRedErrorTypeLabel("logic_error"), "算法逻辑必错");
  assert.equal(getRedErrorTypeLabel("runtime_failure_risk"), "运行时必错风险");
});
