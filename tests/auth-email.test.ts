import assert from "node:assert/strict";
import test from "node:test";

import { sendAuthEmail } from "../src/server/auth/email.ts";

test("sends verification and reset messages through the local Mailpit API", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(null, { status: 200 });
  };

  try {
    const environment = {
      APP_EDITION: "hosted",
      DATABASE_URL: "postgres://app:app@localhost:5432/app",
      BETTER_AUTH_SECRET: "a".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
    };
    await sendAuthEmail(
      "verification",
      { email: "user@example.com" },
      "http://localhost:3000/verify?token=not-logged",
      environment,
    );
    await sendAuthEmail(
      "reset-password",
      { email: "user@example.com" },
      "http://localhost:3000/reset?token=not-logged",
      environment,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  const firstBody = await requests[0].json();
  const secondBody = await requests[1].json();
  assert.equal(firstBody.To[0].Email, "user@example.com");
  assert.match(firstBody.Subject, /验证/);
  assert.match(secondBody.Subject, /重置/);
});
