import { analysisResponseSchema } from "../schemas/analysis-response";
import type {
  AnalysisResponse,
  CodeLocation,
} from "../types/analysis";

export type AnalysisParseIssue = {
  path: Array<string | number>;
  code: string;
  message: string;
};

export type AnalysisParseResult =
  | {
      success: true;
      data: AnalysisResponse;
    }
  | {
      success: false;
      issues: AnalysisParseIssue[];
    };

export function parseAnalysisResponse(input: unknown): AnalysisParseResult {
  const result = analysisResponseSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === "symbol"
          ? (segment.description ?? segment.toString())
          : segment,
      ),
      code: issue.code,
      message: issue.message,
    })),
  };
}

export type CodeLocationFailureReason =
  | "invalid_source_code"
  | "invalid_range"
  | "line_out_of_bounds"
  | "column_out_of_bounds"
  | "exact_code_mismatch";

export type CodeLocationValidationResult =
  | {
      success: true;
      extractedCode: string;
    }
  | {
      success: false;
      reason: CodeLocationFailureReason;
      message: string;
    };

type SourceLine = {
  content: string;
  startOffset: number;
};

function splitSourceLines(sourceCode: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let lineStart = 0;

  for (let index = 0; index < sourceCode.length; index += 1) {
    if (sourceCode[index] === "\r" && sourceCode[index + 1] === "\n") {
      lines.push({
        content: sourceCode.slice(lineStart, index),
        startOffset: lineStart,
      });
      index += 1;
      lineStart = index + 1;
    } else if (sourceCode[index] === "\n") {
      lines.push({
        content: sourceCode.slice(lineStart, index),
        startOffset: lineStart,
      });
      lineStart = index + 1;
    }
  }

  lines.push({
    content: sourceCode.slice(lineStart),
    startOffset: lineStart,
  });

  return lines;
}

function hasValidNumericRange(location: CodeLocation) {
  const positions = [
    location.startLine,
    location.startColumn,
    location.endLine,
    location.endColumn,
  ];

  if (
    positions.some(
      (position) => !Number.isInteger(position) || position < 1,
    )
  ) {
    return false;
  }

  return (
    location.endLine > location.startLine ||
    (location.endLine === location.startLine &&
      location.endColumn > location.startColumn)
  );
}

export function validateCodeLocation(
  location: CodeLocation,
  sourceCode: unknown,
): CodeLocationValidationResult {
  if (typeof sourceCode !== "string") {
    return {
      success: false,
      reason: "invalid_source_code",
      message: "sourceCode 必须是字符串。",
    };
  }

  if (!hasValidNumericRange(location)) {
    return {
      success: false,
      reason: "invalid_range",
      message: "代码范围必须使用正整数，且结束位置严格晚于开始位置。",
    };
  }

  const lines = splitSourceLines(sourceCode);
  const startLine = lines[location.startLine - 1];
  const endLine = lines[location.endLine - 1];

  if (!startLine || !endLine) {
    return {
      success: false,
      reason: "line_out_of_bounds",
      message: "代码范围中的行号超出源代码范围。",
    };
  }

  if (
    location.startColumn > startLine.content.length + 1 ||
    location.endColumn > endLine.content.length + 1
  ) {
    return {
      success: false,
      reason: "column_out_of_bounds",
      message: "代码范围中的列号超出对应代码行范围。",
    };
  }

  const startOffset = startLine.startOffset + location.startColumn - 1;
  const endOffset = endLine.startOffset + location.endColumn - 1;
  const extractedCode = sourceCode.slice(startOffset, endOffset);

  if (extractedCode !== location.exactCode) {
    return {
      success: false,
      reason: "exact_code_mismatch",
      message: "范围内代码与 exactCode 不完全一致。",
    };
  }

  return {
    success: true,
    extractedCode,
  };
}
