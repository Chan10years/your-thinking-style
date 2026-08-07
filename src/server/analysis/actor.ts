import { getAppEdition } from "../../config/edition";

type Environment = Record<string, string | undefined>;

const ANALYSIS_SESSION_COOKIE = "your-thinking-style-session";
const SESSION_ID_PATTERN = /^[0-9a-z-]{16,128}$/i;

export type AnalysisActor =
  | { type: "local"; sessionId: string }
  | { type: "hosted"; sessionId: string; userId: string };

export function getAnalysisSessionId(request: Request): string {
  const cookieSessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ANALYSIS_SESSION_COOKIE}=`))
    ?.slice(ANALYSIS_SESSION_COOKIE.length + 1);

  if (cookieSessionId && SESSION_ID_PATTERN.test(cookieSessionId)) {
    return cookieSessionId;
  }

  const headerSessionId = request.headers
    .get("x-analysis-session-id")
    ?.trim();
  if (headerSessionId && SESSION_ID_PATTERN.test(headerSessionId)) {
    return headerSessionId;
  }

  return crypto.randomUUID();
}

export function attachAnalysisSession(response: Response, sessionId: string) {
  response.headers.append(
    "set-cookie",
    `${ANALYSIS_SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
  );
  return response;
}

export async function resolveAnalysisActor(
  request: Request,
  env: Environment = process.env,
): Promise<AnalysisActor | null> {
  const sessionId = getAnalysisSessionId(request);
  if (getAppEdition(env) === "local") {
    return { type: "local", sessionId };
  }

  const { requireVerifiedSession } = await import("../auth/session");
  const session = await requireVerifiedSession(request, env);
  if (!session) {
    return null;
  }
  return { type: "hosted", sessionId, userId: session.user.id };
}
