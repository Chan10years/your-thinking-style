import type {
  AnalysisMeta,
  NewKnowledgeNeeded,
  PersonalizedPath,
  RedError,
  SuspectedIssue,
  ThoughtRestoration,
} from "../types/analysis";

type EvidenceSource =
  | RedError["evidenceSources"][number]
  | SuspectedIssue["evidenceSource"];

export const THOUGHT_STATUS_LABELS = {
  thought_flawed: "思路本身有问题",
  implementation_bug: "思路大体可行，实现出现错误",
  thought_code_mismatch: "用户描述的思路与代码实现不一致",
  insufficient_information: "信息不足，无法可靠判断用户思路",
} as const satisfies Record<ThoughtRestoration["status"], string>;

export const CONFIDENCE_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
} as const satisfies Record<ThoughtRestoration["confidence"], string>;

export const RED_ERROR_TYPE_LABELS = {
  syntax_or_compile_error: "语法或编译级错误",
  hard_requirement_violation: "题意硬约束违背",
  boundary_case_error: "边界条件必错",
  logic_error: "算法逻辑必错",
  runtime_failure_risk: "运行时必错风险",
} as const satisfies Record<RedError["errorType"], string>;

export const EVIDENCE_SOURCE_LABELS = {
  failure_case: "失败样例支持",
  static_analysis: "静态分析",
  insufficient_evidence: "证据不足",
} as const satisfies Record<EvidenceSource, string>;

export const ACHIEVABLE_LEVEL_LABELS = {
  understanding_only: "只能帮助理解",
  partial_data: "只能通过部分数据",
  full_ac_non_optimal: "可以完整通过，但不是最优",
  full_ac: "可以完整通过",
} as const satisfies Record<PersonalizedPath["achievableLevel"], string>;

export const ANALYSIS_BASIS_LABELS = {
  problem: "题目",
  code: "代码",
  user_thought: "用户思路",
  failure_case: "失败信息",
} as const satisfies Record<AnalysisMeta["analysisBasis"][number], string>;

export const USED_IN_PATH_LABELS = {
  personalizedPath: "个性化修正路径",
  standardPath: "标准路径",
} as const satisfies Record<NewKnowledgeNeeded["usedInPath"][number], string>;

export function getThoughtStatusLabel(status: ThoughtRestoration["status"]) {
  return THOUGHT_STATUS_LABELS[status];
}

export function getConfidenceLabel(
  confidence: ThoughtRestoration["confidence"],
) {
  return CONFIDENCE_LABELS[confidence];
}

export function getRedErrorTypeLabel(errorType: RedError["errorType"]) {
  return RED_ERROR_TYPE_LABELS[errorType];
}

export function getEvidenceSourceLabel(evidenceSource: EvidenceSource) {
  return EVIDENCE_SOURCE_LABELS[evidenceSource];
}

export function getAchievableLevelLabel(
  achievableLevel: PersonalizedPath["achievableLevel"],
) {
  return ACHIEVABLE_LEVEL_LABELS[achievableLevel];
}

export function getAnalysisBasisLabel(
  analysisBasis: AnalysisMeta["analysisBasis"][number],
) {
  return ANALYSIS_BASIS_LABELS[analysisBasis];
}

export function getUsedInPathLabel(
  usedInPath: NewKnowledgeNeeded["usedInPath"][number],
) {
  return USED_IN_PATH_LABELS[usedInPath];
}
