export type AppEdition = "local" | "hosted";

export type EditionCapabilities = {
  allowsAnonymousAnalysis: boolean;
  requiresAuthentication: boolean;
  requiresDatabase: boolean;
  persistsHistory: boolean;
  collectsUsageStats: boolean;
  sendsOfficialTelemetry: boolean;
};

export type HostedEnvironment = {
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  mailFrom: string;
  avatarStorageDir: string;
};

type Environment = Record<string, string | undefined>;

const LOCAL_CAPABILITIES: EditionCapabilities = {
  allowsAnonymousAnalysis: true,
  requiresAuthentication: false,
  requiresDatabase: false,
  persistsHistory: false,
  collectsUsageStats: false,
  sendsOfficialTelemetry: false,
};

const HOSTED_CAPABILITIES: EditionCapabilities = {
  allowsAnonymousAnalysis: false,
  requiresAuthentication: true,
  requiresDatabase: true,
  persistsHistory: true,
  collectsUsageStats: true,
  sendsOfficialTelemetry: false,
};

export function getAppEdition(env: Environment = process.env): AppEdition {
  const value = env.APP_EDITION ?? "local";

  if (value !== "local" && value !== "hosted") {
    throw new Error("APP_EDITION must be local or hosted");
  }

  return value;
}

export function getEditionCapabilities(
  edition: AppEdition,
): EditionCapabilities {
  return edition === "local"
    ? { ...LOCAL_CAPABILITIES }
    : { ...HOSTED_CAPABILITIES };
}

function requiredEnvironmentValue(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required in hosted mode`);
  }
  return value;
}

export function getHostedEnvironment(
  env: Environment = process.env,
): HostedEnvironment {
  const databaseUrl = requiredEnvironmentValue(env, "DATABASE_URL");
  const betterAuthSecret = requiredEnvironmentValue(env, "BETTER_AUTH_SECRET");
  if (betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  const betterAuthUrl = requiredEnvironmentValue(env, "BETTER_AUTH_URL");
  try {
    new URL(betterAuthUrl);
  } catch {
    throw new Error("BETTER_AUTH_URL must be a valid URL");
  }

  return {
    databaseUrl,
    betterAuthSecret,
    betterAuthUrl,
    mailFrom: env.MAIL_FROM?.trim() || "no-reply@localhost",
    avatarStorageDir: env.AVATAR_STORAGE_DIR?.trim() || ".data/avatars",
  };
}
