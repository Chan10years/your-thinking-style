import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, parse, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import {
  buildBackupManifest,
  verifyBackupManifest,
  type BackupManifest,
} from "../src/server/backup/manifest";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
}

function assertSafeOutputRoot(outputRoot: string): void {
  const normalized = resolve(outputRoot);
  const repoRoot = resolve(process.cwd());
  const home = resolve(homedir());
  const filesystemRoot = parse(normalized).root;

  if (normalized === filesystemRoot || normalized === home) {
    throw new Error("BACKUP_OUTPUT_UNSAFE");
  }
  if (normalized === repoRoot) {
    throw new Error("BACKUP_OUTPUT_REPO_ROOT");
  }
}

function runDockerPgDump(outputPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_dump",
        "-U",
        "yourthinkingstyle",
        "-d",
        "yourthinkingstyle",
        "--no-owner",
        "--no-privileges",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", () => reject(new Error("DOCKER_UNAVAILABLE")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errors.join("").trim() || "PG_DUMP_FAILED"));
        return;
      }
      void writeFile(outputPath, Buffer.concat(chunks)).then(resolvePromise, reject);
    });
  });
}

async function createBackup() {
  const outputArgument = argument("--output");
  if (!outputArgument) throw new Error("BACKUP_OUTPUT_REQUIRED");
  const outputRoot = resolve(outputArgument);
  assertSafeOutputRoot(outputRoot);
  const timestamp = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const backupRoot = join(outputRoot, timestamp);
  const stagingRoot = join(outputRoot, `.staging-${randomUUID()}`);
  const avatarSource = resolve(process.env.AVATAR_STORAGE_DIR ?? ".data/avatars");
  await mkdir(join(stagingRoot, "avatars"), { recursive: true });

  try {
    await runDockerPgDump(join(stagingRoot, "database.sql"));
    try {
      await stat(avatarSource);
      await cp(avatarSource, join(stagingRoot, "avatars"), { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const files = ["database.sql"];
    const avatarEntries = await collectFiles(join(stagingRoot, "avatars"), "avatars");
    const manifest = await buildBackupManifest(stagingRoot, [...files, ...avatarEntries]);
    await writeFile(join(stagingRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(stagingRoot, backupRoot);
    console.log(`备份已生成：${backupRoot}`);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function collectFiles(root: string, prefix: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(join(root, entry.name), relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function verifyBackup() {
  const backupArgument = argument("--backup");
  if (!backupArgument) throw new Error("BACKUP_ARGUMENT_REQUIRED");
  const backupRoot = resolve(backupArgument);
  const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8")) as BackupManifest;
  const valid = await verifyBackupManifest(backupRoot, manifest);
  if (!valid) throw new Error("BACKUP_CHECKSUM_MISMATCH");
  console.log(`备份校验通过：${backupRoot}`);
}

const command = process.argv[2] ?? "backup";
if (command === "verify") {
  await verifyBackup();
} else if (command === "backup") {
  await createBackup();
} else {
  throw new Error("BACKUP_COMMAND_INVALID");
}
