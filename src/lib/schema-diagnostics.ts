import type { z } from "zod";

export type SchemaDiagnostic = {
  path: string;
  code: string;
  message: string;
  expected?: string;
  values?: unknown[];
  actualType: string;
  summary: string;
};

export type PersonalizedReferenceCodeDiagnostic = {
  "personalizedPath.achievableLevel": unknown;
  "referenceCode.available": unknown;
  "referenceCode.codeType": unknown;
  "referenceCode.language": unknown;
  "referenceCode.codeLength": number | null;
  "referenceCode.unavailableReasonLength": number | null;
};

const ENUM_PATH_PATTERNS = [
  ["schemaVersion"],
  ["thoughtRestoration", "status"],
  ["thoughtRestoration", "confidence"],
  ["redErrors", "*", "id"],
  ["redErrors", "*", "errorType"],
  ["redErrors", "*", "evidenceLevel"],
  ["redErrors", "*", "evidenceSources", "*"],
  ["suspectedIssues", "*", "evidenceSource"],
  ["fixDirection", "personalizedPath", "referenceCode", "codeType"],
  ["fixDirection", "personalizedPath", "referenceCode", "language"],
  ["fixDirection", "personalizedPath", "achievableLevel"],
  ["fixDirection", "standardPath", "referenceCode", "codeType"],
  ["fixDirection", "standardPath", "referenceCode", "language"],
  ["fixDirection", "newKnowledgeNeeded", "*", "usedInPath", "*"],
  ["meta", "analysisBasis", "*"],
] as const;

function pathToSegments(path: z.ZodIssue["path"]) {
  return path.map((segment) =>
    typeof segment === "symbol"
      ? (segment.description ?? segment.toString())
      : String(segment),
  );
}

function formatPath(path: z.ZodIssue["path"]) {
  return pathToSegments(path).join(".");
}

function isWhitelistedEnumPath(path: z.ZodIssue["path"]) {
  const segments = pathToSegments(path);

  return ENUM_PATH_PATTERNS.some((pattern) => {
    if (pattern.length !== segments.length) {
      return false;
    }

    return pattern.every(
      (segment, index) => segment === "*" || segment === segments[index],
    );
  });
}

function getValueAtPath(input: unknown, path: z.ZodIssue["path"]) {
  let current = input;

  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof segment === "symbol") {
      return undefined;
    }

    if (typeof current !== "object" && !Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string | number, unknown>)[segment];
  }

  return current;
}

function getRecordValue(input: unknown, key: string) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }

  return (input as Record<string, unknown>)[key];
}

function getStringLength(value: unknown) {
  return typeof value === "string" ? value.length : null;
}

function getActualType(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function summarizeObject(value: Record<string, unknown>) {
  return `object(keys=${Object.keys(value).join(",")})`;
}

function summarizeValue(value: unknown, includeStringValue: boolean) {
  const actualType = getActualType(value);

  if (actualType === "undefined" || actualType === "null") {
    return actualType;
  }

  if (typeof value === "string") {
    const lengthSummary = `string(length=${value.length})`;

    if (!includeStringValue) {
      return lengthSummary;
    }

    return `${lengthSummary.slice(0, -1)}, value=${JSON.stringify(value)})`;
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  if (typeof value === "object" && value !== null) {
    return summarizeObject(value as Record<string, unknown>);
  }

  return actualType;
}

function getIssueExpected(issue: z.ZodIssue) {
  if ("expected" in issue && typeof issue.expected === "string") {
    return issue.expected;
  }

  return undefined;
}

function getIssueValues(issue: z.ZodIssue) {
  if ("values" in issue && Array.isArray(issue.values)) {
    return issue.values;
  }

  return undefined;
}

export function formatSchemaValidationIssues(
  issues: z.ZodIssue[],
  input: unknown,
): SchemaDiagnostic[] {
  return issues.map((issue) => {
    const actualValue = getValueAtPath(input, issue.path);

    return {
      path: formatPath(issue.path),
      code: issue.code,
      message: issue.message,
      ...(getIssueExpected(issue) === undefined
        ? {}
        : { expected: getIssueExpected(issue) }),
      ...(getIssueValues(issue) === undefined
        ? {}
        : { values: getIssueValues(issue) }),
      actualType: getActualType(actualValue),
      summary: summarizeValue(
        actualValue,
        typeof actualValue === "string" && isWhitelistedEnumPath(issue.path),
      ),
    };
  });
}

export function formatPersonalizedReferenceCodeDiagnostic(
  input: unknown,
): PersonalizedReferenceCodeDiagnostic {
  const personalizedPath = getValueAtPath(input, [
    "fixDirection",
    "personalizedPath",
  ]);
  const referenceCode = getValueAtPath(input, [
    "fixDirection",
    "personalizedPath",
    "referenceCode",
  ]);

  return {
    "personalizedPath.achievableLevel": getRecordValue(
      personalizedPath,
      "achievableLevel",
    ),
    "referenceCode.available": getRecordValue(referenceCode, "available"),
    "referenceCode.codeType": getRecordValue(referenceCode, "codeType"),
    "referenceCode.language": getRecordValue(referenceCode, "language"),
    "referenceCode.codeLength": getStringLength(
      getRecordValue(referenceCode, "code"),
    ),
    "referenceCode.unavailableReasonLength": getStringLength(
      getRecordValue(referenceCode, "unavailableReason"),
    ),
  };
}

export function hasPersonalizedReferenceCodeIssue(issues: z.ZodIssue[]) {
  return issues.some(
    (issue) =>
      formatPath(issue.path) ===
      "fixDirection.personalizedPath.referenceCode",
  );
}
