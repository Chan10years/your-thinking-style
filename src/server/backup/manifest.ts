import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

export type BackupManifestFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type BackupManifest = {
  algorithm: "sha256";
  files: BackupManifestFile[];
};

function safePath(root: string, filePath: string): string {
  const rootPath = resolve(root);
  const resolvedPath = resolve(rootPath, filePath);
  const relativePath = relative(rootPath, resolvedPath);
  if (!relativePath || relativePath.startsWith("..")) {
    throw new Error("BACKUP_PATH_INVALID");
  }
  return resolvedPath;
}

async function hashFile(path: string) {
  const content = await readFile(path);
  return {
    bytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

export async function buildBackupManifest(
  root: string,
  files: string[],
): Promise<BackupManifest> {
  const entries: BackupManifestFile[] = [];
  for (const filePath of files) {
    const path = safePath(root, filePath);
    const metadata = await stat(path);
    const hash = await hashFile(path);
    entries.push({ path: filePath.replaceAll("\\", "/"), ...hash });
    if (!metadata.isFile()) {
      throw new Error("BACKUP_FILE_INVALID");
    }
  }
  return { algorithm: "sha256", files: entries };
}

export async function verifyBackupManifest(
  root: string,
  manifest: BackupManifest,
): Promise<boolean> {
  if (manifest.algorithm !== "sha256") {
    return false;
  }
  try {
    for (const entry of manifest.files) {
      const path = safePath(root, entry.path);
      const metadata = await stat(path);
      if (!metadata.isFile() || metadata.size !== entry.bytes) {
        return false;
      }
      const hash = await hashFile(path);
      if (hash.sha256 !== entry.sha256) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
