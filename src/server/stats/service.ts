import { count, eq, gte, sql } from "drizzle-orm";

import {
  getAppEdition,
  getHostedEnvironment,
  type HostedEnvironment,
} from "../../config/edition";
import { getDatabase } from "../db/client";
import { authUser, dailyUserActivity } from "../db/schema";

type Environment = Record<string, string | undefined>;

export type UsageMetrics = {
  generatedAt: string;
  registeredUsers: number;
  verifiedUsers: number;
  dau: number;
  wau: number;
  mau: number;
  successfulDiagnoses: number;
  averageDiagnosesPerRegisteredUser: number;
  sevenDayReturnUsers: number;
};

export function getStatsEnvironment(
  env: Environment = process.env,
): HostedEnvironment {
  if (getAppEdition(env) !== "hosted") {
    throw new Error("STATS_DISABLED");
  }
  return getHostedEnvironment(env);
}

function utcDateOffset(daysAgo: number, now: Date): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function distinctUsersSince(date: string) {
  const rows = await getDatabase()
    .select({ count: sql<number>`count(distinct ${dailyUserActivity.userId})` })
    .from(dailyUserActivity)
    .where(gte(dailyUserActivity.activityDate, date));
  return Number(rows[0]?.count ?? 0);
}

export async function collectUsageStats(now = new Date()): Promise<UsageMetrics> {
  getStatsEnvironment();
  const database = getDatabase();
  const [registered, verified, successful] = await Promise.all([
    database.select({ count: count() }).from(authUser),
    database
      .select({ count: count() })
      .from(authUser)
      .where(eq(authUser.emailVerified, true)),
    database
      .select({ total: sql<number>`coalesce(sum(${dailyUserActivity.successfulAnalyses}), 0)` })
      .from(dailyUserActivity),
  ]);

  const [dau, wau, mau] = await Promise.all([
    distinctUsersSince(utcDateOffset(0, now)),
    distinctUsersSince(utcDateOffset(6, now)),
    distinctUsersSince(utcDateOffset(29, now)),
  ]);

  const returnRows = await database
    .select({ userId: dailyUserActivity.userId, activityDate: dailyUserActivity.activityDate })
    .from(dailyUserActivity)
    .where(gte(dailyUserActivity.activityDate, utcDateOffset(6, now)));
  const activeDates = new Map<string, Set<string>>();
  for (const row of returnRows) {
    const dates = activeDates.get(row.userId) ?? new Set<string>();
    dates.add(row.activityDate);
    activeDates.set(row.userId, dates);
  }

  const registeredUsers = Number(registered[0]?.count ?? 0);
  const successfulDiagnoses = Number(successful[0]?.total ?? 0);
  return {
    generatedAt: now.toISOString(),
    registeredUsers,
    verifiedUsers: Number(verified[0]?.count ?? 0),
    dau,
    wau,
    mau,
    successfulDiagnoses,
    averageDiagnosesPerRegisteredUser:
      registeredUsers === 0
        ? 0
        : Number((successfulDiagnoses / registeredUsers).toFixed(2)),
    sevenDayReturnUsers: [...activeDates.values()].filter((dates) => dates.size >= 2)
      .length,
  };
}

export function formatUsageReport(metrics: UsageMetrics): UsageMetrics {
  return metrics;
}
