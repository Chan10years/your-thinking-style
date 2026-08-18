import { eq } from "drizzle-orm";

import { getHostedEnvironment } from "../../config/edition";
import { getDatabase } from "../db/client";
import { userProfiles } from "../db/schema";
import { normalizeAvatarFile } from "./avatar";
import { createLocalAvatarStorage } from "./avatar-storage";
import { createDefaultAvatarSvg } from "./default-avatar";
import { ensureUserProfile } from "./service";

type Environment = Record<string, string | undefined>;

export async function saveUserAvatar(
  userId: string,
  file: File,
  env: Environment = process.env,
) {
  const normalized = await normalizeAvatarFile(file);
  const hosted = getHostedEnvironment(env);
  const storage = createLocalAvatarStorage(hosted.avatarStorageDir);
  const profile = await ensureUserProfile(userId);
  const newPath = await storage.save(userId, normalized);

  let updated;
  try {
    updated = await getDatabase(env)
      .update(userProfiles)
      .set({ avatarPath: newPath, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    if (!updated[0]) {
      throw new Error("PROFILE_UPDATE_FAILED");
    }
  } catch (error) {
    await storage.remove(newPath);
    throw error;
  }

  if (profile.avatarPath && profile.avatarPath !== newPath) {
    await storage.remove(profile.avatarPath);
  }
  return updated[0];
}

export async function removeUserAvatar(
  userId: string,
  env: Environment = process.env,
) {
  const hosted = getHostedEnvironment(env);
  const storage = createLocalAvatarStorage(hosted.avatarStorageDir);
  const profile = await ensureUserProfile(userId);
  if (!profile.avatarPath) {
    return profile;
  }

  const updated = await getDatabase(env)
    .update(userProfiles)
    .set({ avatarPath: null, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();
  if (!updated[0]) {
    throw new Error("PROFILE_UPDATE_FAILED");
  }

  await storage.remove(profile.avatarPath);
  return updated[0];
}

export async function getUserAvatar(
  userId: string,
  env: Environment = process.env,
): Promise<{ body: Buffer; contentType: string } | { defaultSeed: string }> {
  const hosted = getHostedEnvironment(env);
  const profile = await ensureUserProfile(userId);
  if (!profile.avatarPath) {
    return { defaultSeed: profile.avatarSeed };
  }

  const storage = createLocalAvatarStorage(hosted.avatarStorageDir);
  const avatar = await storage.read(profile.avatarPath);
  if (!avatar) {
    return { defaultSeed: profile.avatarSeed };
  }
  return { body: avatar, contentType: "image/webp" };
}

export { createDefaultAvatarSvg };
