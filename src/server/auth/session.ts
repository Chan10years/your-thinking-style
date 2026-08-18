import type { Session } from "better-auth";

import { getAppEdition } from "../../config/edition";
import { getAuth } from "./config";

type Environment = Record<string, string | undefined>;

export type VerifiedSession = {
  session: Session;
  user: {
    id: string;
    email: string;
    emailVerified: true;
    [key: string]: unknown;
  };
};

export async function getAuthSession(
  request: Request,
  env: Environment = process.env,
) {
  if (getAppEdition(env) !== "hosted") {
    return null;
  }

  const auth = await getAuth(env);
  return auth.api.getSession({ headers: request.headers });
}

export async function requireVerifiedSession(
  request: Request,
  env: Environment = process.env,
): Promise<VerifiedSession | null> {
  const session = await getAuthSession(request, env);
  if (!session || !session.user.emailVerified) {
    return null;
  }

  return {
    session: session.session,
    user: session.user as VerifiedSession["user"],
  };
}
