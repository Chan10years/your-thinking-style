const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;

type SessionRequestState = {
  requestStarts: number[];
  inFlight: boolean;
};

export type AnalysisRequestDecision =
  | { allowed: true }
  | { allowed: false; reason: "in_progress" }
  | {
      allowed: false;
      reason: "rate_limited";
      retryAfterSeconds: number;
    };

export function createAnalysisRequestGuard() {
  const sessions = new Map<string, SessionRequestState>();

  function prune(now: number) {
    const windowStart = now - REQUEST_WINDOW_MS;

    for (const [sessionId, state] of sessions) {
      state.requestStarts = state.requestStarts.filter(
        (startedAt) => startedAt > windowStart,
      );

      if (!state.inFlight && state.requestStarts.length === 0) {
        sessions.delete(sessionId);
      }
    }
  }

  return {
    begin(sessionId: string, now = Date.now()): AnalysisRequestDecision {
      prune(now);

      const state = sessions.get(sessionId) ?? {
        requestStarts: [],
        inFlight: false,
      };

      if (state.inFlight) {
        return { allowed: false, reason: "in_progress" };
      }

      if (state.requestStarts.length >= MAX_REQUESTS_PER_WINDOW) {
        return {
          allowed: false,
          reason: "rate_limited",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(
              (state.requestStarts[0] + REQUEST_WINDOW_MS - now) / 1_000,
            ),
          ),
        };
      }

      state.requestStarts.push(now);
      state.inFlight = true;
      sessions.set(sessionId, state);

      return { allowed: true };
    },

    finish(sessionId: string) {
      const state = sessions.get(sessionId);

      if (state) {
        state.inFlight = false;
      }
    },
  };
}

export const analysisRequestGuard = createAnalysisRequestGuard();
