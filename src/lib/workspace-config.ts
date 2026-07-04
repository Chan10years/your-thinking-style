import { INPUT_LIMITS, type AnalysisInput } from "./input-validation";

export type ThemePreference = "system" | "light" | "dark";
export type FailureField = Extract<
  keyof AnalysisInput,
  "failureInput" | "expectedOutput" | "actualOutput"
>;

export const THEME_OPTIONS = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
] as const satisfies ReadonlyArray<{
  value: ThemePreference;
  label: string;
}>;

export const FAILURE_TABS = [
  {
    field: "failureInput",
    label: "失败输入",
    placeholder: "粘贴一个失败样例的输入",
    limit: INPUT_LIMITS.failureInput,
  },
  {
    field: "expectedOutput",
    label: "预期输出",
    placeholder: "这个样例正确时应该输出什么",
    limit: INPUT_LIMITS.expectedOutput,
  },
  {
    field: "actualOutput",
    label: "实际输出 / 报错",
    placeholder: "粘贴实际输出、报错信息或平台反馈",
    limit: INPUT_LIMITS.actualOutput,
  },
] as const satisfies ReadonlyArray<{
  field: FailureField;
  label: string;
  placeholder: string;
  limit: number;
}>;

export const WORKSPACE_RATIOS = {
  mainLeft: 45,
  mainRight: 55,
  code: 60,
  supplemental: 40,
  thought: 45,
  failure: 55,
} as const;

export const WORKSPACE_LAYOUT_STORAGE_KEY =
  "yourthinkingstyle.workspace.layout";

export type WorkspaceLayout = {
  main: {
    problem: number;
    workspace: number;
  };
  right: {
    code: number;
    supplemental: number;
  };
  supplemental: {
    thought: number;
    failure: number;
  };
};

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  main: {
    problem: WORKSPACE_RATIOS.mainLeft,
    workspace: WORKSPACE_RATIOS.mainRight,
  },
  right: {
    code: WORKSPACE_RATIOS.code,
    supplemental: WORKSPACE_RATIOS.supplemental,
  },
  supplemental: {
    thought: WORKSPACE_RATIOS.thought,
    failure: WORKSPACE_RATIOS.failure,
  },
};

function isPanelPair(
  value: unknown,
  firstKey: string,
  secondKey: string,
): value is Record<string, number> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pair = value as Record<string, unknown>;
  const first = pair[firstKey];
  const second = pair[secondKey];

  return (
    typeof first === "number" &&
    Number.isFinite(first) &&
    first > 0 &&
    typeof second === "number" &&
    Number.isFinite(second) &&
    second > 0 &&
    Math.abs(first + second - 100) < 0.01
  );
}

export function parseWorkspaceLayout(value: string | null): WorkspaceLayout {
  if (!value) {
    return DEFAULT_WORKSPACE_LAYOUT;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_WORKSPACE_LAYOUT;
    }

    const layout = parsed as Record<string, unknown>;

    if (
      !isPanelPair(layout.main, "problem", "workspace") ||
      !isPanelPair(layout.right, "code", "supplemental") ||
      !isPanelPair(layout.supplemental, "thought", "failure")
    ) {
      return DEFAULT_WORKSPACE_LAYOUT;
    }

    return parsed as WorkspaceLayout;
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}
