import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the local root direct-to-workbench and hosted account pages in the app", async () => {
  const rootPage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(rootPage, /getAppEdition/);
  assert.match(rootPage, /AnalyzePage/);
  for (const page of [
    "login/page.tsx",
    "register/page.tsx",
    "verify-email/page.tsx",
    "forgot-password/page.tsx",
    "reset-password/page.tsx",
    "profile/page.tsx",
    "history/page.tsx",
  ]) {
    await access(new URL(`../src/app/${page}`, import.meta.url));
  }
});
