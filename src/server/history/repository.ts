import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { analysisHistory } from "../db/schema";
import { formatHistoryRecord, type HistoryListQuery } from "./query";

export async function listUserHistory(
  userId: string,
  query: HistoryListQuery,
) {
  const rows = await getDatabase()
    .select()
    .from(analysisHistory)
    .where(eq(analysisHistory.userId, userId))
    .orderBy(desc(analysisHistory.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return rows.map(formatHistoryRecord);
}

export async function getUserHistory(userId: string, historyId: string) {
  const rows = await getDatabase()
    .select()
    .from(analysisHistory)
    .where(
      and(
        eq(analysisHistory.userId, userId),
        eq(analysisHistory.id, historyId),
      ),
    )
    .limit(1);
  return rows[0] ? formatHistoryRecord(rows[0]) : null;
}

export async function deleteUserHistory(userId: string, historyId: string) {
  const deleted = await getDatabase()
    .delete(analysisHistory)
    .where(
      and(
        eq(analysisHistory.userId, userId),
        eq(analysisHistory.id, historyId),
      ),
    )
    .returning({ id: analysisHistory.id });
  return Boolean(deleted[0]);
}
