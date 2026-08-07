import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultProfile,
  parseProfilePatch,
} from "../src/server/profile/defaults.ts";

test("generates the planned default nickname and avatar seed", () => {
  const profile = createDefaultProfile(() => 0);
  assert.match(profile.nickname, /^用户-[A-Z0-9]{6}$/);
  assert.equal(profile.nickname, "用户-AAAAAA");
  assert.equal(profile.avatarSeed.length, 36);
});

test("accepts only a trimmed nickname in the first profile patch", () => {
  assert.deepEqual(parseProfilePatch({ nickname: "  新昵称  " }), {
    nickname: "新昵称",
  });
  assert.throws(() => parseProfilePatch({ nickname: " " }), /昵称/);
  assert.throws(() => parseProfilePatch({ nickname: "a".repeat(33) }), /昵称/);
  assert.throws(() => parseProfilePatch({ nickname: "x", extra: true }), /昵称/);
});

test("local profile route is unavailable", async () => {
  const route = await import("../src/app/api/profile/route.ts");
  const response = await route.GET(
    new Request("http://localhost:3000/api/profile"),
  );
  assert.equal(response.status, 404);
});
