import type { Auth } from "better-auth";

import { getAppEdition, getHostedEnvironment } from "../../config/edition";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "../db/schema";
import { getDatabase } from "../db/client";
import {
  createResetPasswordEmailSender,
  createVerificationEmailSender,
} from "./email";

type Environment = Record<string, string | undefined>;

export const AUTH_POLICY = {
  sessionExpiresInSeconds: 60 * 60 * 24 * 30,
  sessionUpdateAgeInSeconds: 60 * 60 * 24,
  requireEmailVerification: true,
  autoSignInAfterSignUp: false,
  revokeSessionsOnPasswordReset: true,
  socialProvidersEnabled: false,
  multiFactorEnabled: false,
} as const;

let authPromise: Promise<Auth> | undefined;

async function createAuth(env: Environment): Promise<Auth> {
  const hosted = getHostedEnvironment(env);
  const [{ betterAuth }, { drizzleAdapter }, { nextCookies }] =
    await Promise.all([
      import("better-auth"),
      import("@better-auth/drizzle-adapter"),
      import("better-auth/next-js"),
    ]);

  const database = getDatabase(env);

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      camelCase: true,
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    baseURL: hosted.betterAuthUrl,
    secret: hosted.betterAuthSecret,
    trustedOrigins: [hosted.betterAuthUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: AUTH_POLICY.requireEmailVerification,
      autoSignIn: AUTH_POLICY.autoSignInAfterSignUp,
      revokeSessionsOnPasswordReset:
        AUTH_POLICY.revokeSessionsOnPasswordReset,
      sendResetPassword: createResetPasswordEmailSender(env),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: createVerificationEmailSender(env),
    },
    session: {
      expiresIn: AUTH_POLICY.sessionExpiresInSeconds,
      updateAge: AUTH_POLICY.sessionUpdateAgeInSeconds,
    },
    useSecureCookies: hosted.betterAuthUrl.startsWith("https://"),
    advanced: {
      cookiePrefix: "yourthinkingstyle",
    },
    plugins: [nextCookies()],
  }) as unknown as Auth;
}

export async function getAuth(env: Environment = process.env): Promise<Auth> {
  if (getAppEdition(env) !== "hosted") {
    throw new Error("AUTH_DISABLED");
  }

  if (!authPromise) {
    authPromise = createAuth(env).catch((error: unknown) => {
      authPromise = undefined;
      throw error;
    });
  }

  return authPromise;
}
