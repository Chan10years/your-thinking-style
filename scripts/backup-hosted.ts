import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  buildBackupManifest,
  verifyBackupManifest,
  type BackupManifest,
} from "../src/server/backup/manifest";

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
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
  const outputRoot = resolve(argument("--output", ".data/backups"));
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const backupRoot = join(outputRoot, timestamp);
  const avatarSource = resolve(process.env.AVATAR_STORAGE_DIR ?? ".data/avatars");
  await mkdir(join(backupRoot, "avatars"), { recursive: true });
  await runDockerPgDump(join(backupRoot, "database.sql"));
  await cp(avatarSource, join(backupRoot, "avatars"), { recursive: true, force: true });

  const files = ["database.sql"];
  const avatarEntries = await collectFiles(join(backupRoot, "avatars"), "avatars");
  const manifest = await buildBackupManifest(backupRoot, [...files, ...avatarEntries]);
  await writeFile(join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`备份已生成：${backupRoot}`);
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
  const backupRoot = resolve(argument("--backup", ""));
  if (!backupRoot) throw new Error("BACKUP_ARGUMENT_REQUIRED");
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
