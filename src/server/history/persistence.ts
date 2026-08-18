import { sql } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { analysisHistory, dailyUserActivity } from "../db/schema";

export type AnalysisHistoryInput = {
  problem: string;
  code: string;
  userThought: string;
  failureInput: string;
  expectedOutput: string;
  actualOutput: string;
};

export function buildHistoryInsert(
  userId: string,
  input: AnalysisHistoryInput,
  result: Record<string, unknown>,
) {
  return {
    userId,
    problem: input.problem,
    code: input.code,
    userThought: input.userThought,
    failureInput: input.failureInput,
    expectedOutput: input.expectedOutput,
    actualOutput: input.actualOutput,
    schemaVersion: typeof result.schemaVersion === "string" ? result.schemaVersion : "mvp-1",
    result,
  };
}

export async function saveAnalysisHistory(
  userId: string,
  input: AnalysisHistoryInput,
  result: Record<string, unknown>,
): Promise<{ saved: true; id: string } | { saved: false }> {
  const record = buildHistoryInsert(userId, input, result);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const inserted = await getDatabase()
        .insert(analysisHistory)
        .values(record)
        .returning({ id: analysisHistory.id });
      if (inserted[0]) {
        return { saved: true, id: inserted[0].id };
      }
    } catch {
      // The current analysis result remains useful even when persistence is unavailable.
    }
  }
  return { saved: false };
}

export async function recordSuccessfulAnalysis(userId: string): Promise<boolean> {
  const activityDate = new Date().toISOString().slice(0, 10);
  try {
    await getDatabase()
      .insert(dailyUserActivity)
      .values({ userId, activityDate, successfulAnalyses: 1 })
      .onConflictDoUpdate({
        target: [dailyUserActivity.userId, dailyUserActivity.activityDate],
        set: {
          successfulAnalyses: sql`${dailyUserActivity.successfulAnalyses} + 1`,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    return false;
  }
}

export async function persistSuccessfulAnalysis(
  userId: string,
  input: AnalysisHistoryInput,
  result: Record<string, unknown>,
) {
  const history = await saveAnalysisHistory(userId, input, result);
  const activitySaved = await recordSuccessfulAnalysis(userId);
  return {
    historySaved: history.saved,
    historyId: history.saved ? history.id : undefined,
    activitySaved,
  };
}
