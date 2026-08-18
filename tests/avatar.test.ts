import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import {
  AVATAR_MAX_BYTES,
  normalizeAvatarFile,
} from "../src/server/profile/avatar.ts";
import {
  createLocalAvatarStorage,
  resolveAvatarPath,
} from "../src/server/profile/avatar-storage.ts";

test("normalizes an accepted PNG avatar to a 256x256 WebP", async () => {
  const input = await sharp({
    create: {
      width: 32,
      height: 64,
      channels: 4,
      background: { r: 20, g: 100, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const file = new File([input], "avatar.png", { type: "image/png" });

  const normalized = await normalizeAvatarFile(file);
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
});

test("rejects SVG, GIF, forged extensions, and oversized uploads", async () => {
  await assert.rejects(
    () =>
      normalizeAvatarFile(
        new File(["<svg></svg>"], "avatar.svg", {
          type: "image/svg+xml",
        }),
      ),
    /头像格式/,
  );

  await assert.rejects(
    () =>
      normalizeAvatarFile(
        new File([new Uint8Array([1, 2, 3])], "avatar.gif", {
          type: "image/gif",
        }),
      ),
    /头像格式/,
  );

  const png = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: "red",
    },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () =>
      normalizeAvatarFile(new File([png], "avatar.jpg", { type: "image/jpeg" })),
    /头像格式/,
  );

  await assert.rejects(
    () =>
      normalizeAvatarFile(
        new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], "avatar.png", {
          type: "image/png",
        }),
      ),
    /头像文件不能超过 5MB/,
  );
});

test("keeps avatar paths inside the configured user directory", () => {
  const safe = resolveAvatarPath(
    ".data/avatars",
    "user-123",
    "user-123/00000000-0000-0000-0000-000000000000.webp",
  );
  assert.match(safe, /user-123[\\/]00000000-0000-0000-0000-000000000000\.webp$/);
  assert.throws(
    () => resolveAvatarPath(".data/avatars", "user-123", "../other.webp"),
    /头像路径不合法/,
  );
  assert.throws(
    () => resolveAvatarPath(".data/avatars", "../other", "other/avatar.webp"),
    /头像路径不合法/,
  );
});

test("local avatar route is unavailable", async () => {
  const route = await import("../src/app/api/profile/avatar/route.ts");
  const response = await route.GET(
    new Request("http://localhost:3000/api/profile/avatar"),
  );
  assert.equal(response.status, 404);
});

test("local storage replaces and removes only its own avatar file", async () => {
  const root = `${process.cwd()}/.tmp-avatar-test-${crypto.randomUUID()}`;
  const storage = createLocalAvatarStorage(root);
  try {
    const path = await storage.save("user-123", Buffer.from("webp"));
    assert.equal((await storage.read(path))?.toString(), "webp");
    await storage.remove(path);
    assert.equal(await storage.read(path), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
