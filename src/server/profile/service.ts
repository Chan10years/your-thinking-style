import { eq } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { userProfiles } from "../db/schema";
import { createDefaultProfile } from "./defaults";

export async function ensureUserProfile(userId: string) {
  const database = getDatabase();
  const existing = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const defaults = createDefaultProfile();
  const created = await database
    .insert(userProfiles)
    .values({
      userId,
      nickname: defaults.nickname,
      avatarSeed: defaults.avatarSeed,
    })
    .onConflictDoNothing({ target: userProfiles.userId })
    .returning();

  if (created[0]) {
    return created[0];
  }

  const afterRace = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (!afterRace[0]) {
    throw new Error("PROFILE_CREATE_FAILED");
  }
  return afterRace[0];
}

export async function updateUserProfile(userId: string, nickname: string) {
  const database = getDatabase();
  const updated = await database
    .update(userProfiles)
    .set({ nickname, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!updated[0]) {
    return ensureUserProfile(userId);
  }
  return updated[0];
}
