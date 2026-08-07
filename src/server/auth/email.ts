import type { User } from "better-auth";

import { getHostedEnvironment } from "../../config/edition";

type Environment = Record<string, string | undefined>;

type AuthEmailKind = "verification" | "reset-password";

function buildSubject(kind: AuthEmailKind): string {
  return kind === "verification" ? "验证你的 YourThinkingStyle 邮箱" : "重置你的 YourThinkingStyle 密码";
}

function buildText(kind: AuthEmailKind, url: string): string {
  const action = kind === "verification" ? "验证邮箱" : "重置密码";
  return `请打开以下链接完成${action}：\n\n${url}\n\n如果这不是你的操作，请忽略此邮件。`;
}

export async function sendAuthEmail(
  kind: AuthEmailKind,
  user: Pick<User, "email">,
  url: string,
  env: Environment = process.env,
): Promise<void> {
  const hosted = getHostedEnvironment(env);
  const endpoint =
    env.MAILPIT_API_URL?.trim() || "http://localhost:8025/api/v1/send";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      From: { Email: hosted.mailFrom },
      To: [{ Email: user.email }],
      Subject: buildSubject(kind),
      Text: buildText(kind, url),
      HTML: `<p>请点击链接完成操作：</p><p><a href="${url}">${url}</a></p>`,
    }),
  });

  if (!response.ok) {
    throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
  }
}

export function createVerificationEmailSender(env: Environment) {
  return async ({ user, url }: { user: Pick<User, "email">; url: string }) =>
    sendAuthEmail("verification", user, url, env);
}

export function createResetPasswordEmailSender(env: Environment) {
  return async ({ user, url }: { user: Pick<User, "email">; url: string }) =>
    sendAuthEmail("reset-password", user, url, env);
}
