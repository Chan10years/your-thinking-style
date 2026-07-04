export const INPUT_LIMITS = {
  problem: 6000,
  code: 12000,
  userThought: 800,
  failureInput: 2000,
  expectedOutput: 1000,
  actualOutput: 2000,
} as const;

export type AnalysisInput = {
  problem: string;
  code: string;
  apiKey: string;
  userThought: string;
  failureInput: string;
  expectedOutput: string;
  actualOutput: string;
};

export type AnalysisInputErrors = Partial<Record<keyof AnalysisInput, string>>;

export type AnalysisInputValidationResult = {
  isValid: boolean;
  errors: AnalysisInputErrors;
};

const FIELD_LIMIT_MESSAGES: Partial<Record<keyof AnalysisInput, string>> = {
  problem: "题目不能超过 6000 字。",
  code: "C++ 代码不能超过 12000 字。",
  userThought: "我的思路或卡点不能超过 800 字。",
  failureInput: "失败输入不能超过 2000 字。",
  expectedOutput: "预期输出不能超过 1000 字。",
  actualOutput: "实际输出或报错不能超过 2000 字。",
};

const FIELD_LIMITS: Partial<Record<keyof AnalysisInput, number>> = {
  problem: INPUT_LIMITS.problem,
  code: INPUT_LIMITS.code,
  userThought: INPUT_LIMITS.userThought,
  failureInput: INPUT_LIMITS.failureInput,
  expectedOutput: INPUT_LIMITS.expectedOutput,
  actualOutput: INPUT_LIMITS.actualOutput,
};

export function validateAnalysisInput(
  input: AnalysisInput,
): AnalysisInputValidationResult {
  const errors: AnalysisInputErrors = {};

  if (input.problem.trim().length === 0) {
    errors.problem = "请填写算法题目。";
  }

  if (input.code.trim().length === 0) {
    errors.code = "请填写 C++ 代码。";
  }

  if (input.apiKey.trim().length === 0) {
    errors.apiKey = "请填写 DeepSeek API Key。";
  }

  for (const [field, limit] of Object.entries(FIELD_LIMITS) as Array<
    [keyof AnalysisInput, number]
  >) {
    if (input[field].length > limit) {
      errors[field] = FIELD_LIMIT_MESSAGES[field];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
