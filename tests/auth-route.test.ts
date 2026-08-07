import assert from "node:assert/strict";
import test from "node:test";

test("local auth route is unavailable instead of creating a hidden account store", async () => {
  const route = await import("../src/app/api/auth/[...all]/route.ts");
  const response = await route.GET(
    new Request("http://localhost:3000/api/auth/get-session"),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: "AUTH_DISABLED", message: "账户功能仅在 hosted 版本提供。" },
  });
});
