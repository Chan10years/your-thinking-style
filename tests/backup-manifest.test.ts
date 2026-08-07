import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildBackupManifest,
  verifyBackupManifest,
} from "../src/server/backup/manifest.ts";

test("builds and verifies a SHA-256 manifest for backup files", async () => {
  const root = await mkdtemp(join(tmpdir(), "yourthinkingstyle-backup-"));
  try {
    const dump = join(root, "database.sql");
    const avatars = join(root, "avatars", "user.webp");
    await writeFile(dump, "CREATE TABLE user;");
    await mkdir(join(root, "avatars"));
    await writeFile(avatars, Buffer.from("avatar"));

    const manifest = await buildBackupManifest(root, ["database.sql", "avatars/user.webp"]);
    assert.equal(manifest.files.length, 2);
    assert.equal(await verifyBackupManifest(root, manifest), true);

    await writeFile(avatars, Buffer.from("changed"));
    assert.equal(await verifyBackupManifest(root, manifest), false);
    assert.equal((await readFile(dump, "utf8")).includes("CREATE TABLE"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
