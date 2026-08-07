export const DEFAULT_HISTORY_LIMIT = 20;
export const MAX_HISTORY_LIMIT = 50;

export type HistoryListQuery = {
  limit: number;
  offset: number;
};

function parseNonNegativeInteger(value: string | null, fallback: number): number {
  if (value === null || value === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("分页参数不合法。");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("分页参数不合法。");
  }
  return parsed;
}

export function parseHistoryListQuery(params: URLSearchParams): HistoryListQuery {
  const requestedLimit = parseNonNegativeInteger(
    params.get("limit"),
    DEFAULT_HISTORY_LIMIT,
  );
  if (requestedLimit === 0) {
    throw new Error("分页参数不合法。");
  }
  return {
    limit: Math.min(requestedLimit, MAX_HISTORY_LIMIT),
    offset: parseNonNegativeInteger(params.get("offset"), 0),
  };
}

export type HistoryRowForOutput = {
  id: string;
  userId: string;
  problem: string;
  code: string;
  userThought: string;
  failureInput: string;
  expectedOutput: string;
  actualOutput: string;
  schemaVersion: string;
  result: unknown;
  createdAt: Date;
};

export function formatHistoryRecord(row: HistoryRowForOutput) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    input: {
      problem: row.problem,
      code: row.code,
      userThought: row.userThought,
      failureInput: row.failureInput,
      expectedOutput: row.expectedOutput,
      actualOutput: row.actualOutput,
    },
    schemaVersion: row.schemaVersion,
    result: row.result,
  };
}
