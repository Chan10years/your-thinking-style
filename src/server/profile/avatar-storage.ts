import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const AVATAR_PATH_PATTERN = /^[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.webp$/i;

function normalizedRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function resolveAvatarPath(
  root: string,
  userId: string,
  avatarPath: string,
): string {
  const relativeAvatarPath = normalizedRelativePath(avatarPath);
  if (
    !USER_ID_PATTERN.test(userId) ||
    !AVATAR_PATH_PATTERN.test(relativeAvatarPath) ||
    !relativeAvatarPath.startsWith(`${userId}/`)
  ) {
    throw new Error("头像路径不合法");
  }

  const rootPath = resolve(root);
  const resolvedPath = resolve(rootPath, relativeAvatarPath);
  const relativeToRoot = relative(rootPath, resolvedPath);
  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    relativeToRoot.includes(`..${resolve(".").includes("\\") ? "\\" : "/"}`)
  ) {
    throw new Error("头像路径不合法");
  }
  return resolvedPath;
}

export type AvatarStorage = {
  save(userId: string, content: Buffer): Promise<string>;
  read(avatarPath: string): Promise<Buffer | null>;
  remove(avatarPath: string): Promise<void>;
};

export function createLocalAvatarStorage(root: string): AvatarStorage {
  return {
    async save(userId, content) {
      const avatarPath = `${userId}/${crypto.randomUUID()}.webp`;
      const target = resolveAvatarPath(root, userId, avatarPath);
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, content, { flag: "wx" });
      await rename(temporary, target);
      return avatarPath;
    },

    async read(avatarPath) {
      const userId = normalizedRelativePath(avatarPath).split("/")[0] ?? "";
      const target = resolveAvatarPath(root, userId, avatarPath);
      try {
        return await readFile(target);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },

    async remove(avatarPath) {
      const userId = normalizedRelativePath(avatarPath).split("/")[0] ?? "";
      const target = resolveAvatarPath(root, userId, avatarPath);
      await rm(target, { force: true });
    },
  };
}
