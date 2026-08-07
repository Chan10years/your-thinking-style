# MVP Stage One Completion Design

> **Status: historical.** This document records the constraints of the completed
> stage-one MVP. Its no-database rule and timeout values do not govern the hosted
> account backend. Follow
> [the current backend design](2026-08-07-hosted-backend-architecture-design.md)
> for new work.

## Scope

Close only the five frozen MVP gaps approved for stage one:

1. Allow at most three analysis requests per browser session in a rolling 60-second window.
2. Allow only one in-flight analysis request per browser session on the server.
3. Retry one complete DeepSeek analysis when the first model content is not valid JSON or fails schema validation.
4. Keep supplemental inputs collapsed by default before analysis, while preserving all entered values when collapsed and keeping the existing post-analysis supplemental summary.
5. Align the hosted function duration with the 61-second DeepSeek timeout.

No authentication, database, history, code execution, judging, new model, or new persistent user data is added.

## Request Protection

Before the first request, the page synchronously creates an opaque random session identifier, keeps it as a session cookie, and sends it in the `x-analysis-session-id` header. This closes the first-request race where two simultaneous requests could otherwise receive different identifiers. The API validates the identifier and returns the same cookie as `HttpOnly`, `SameSite=Lax`. A focused server-side guard stores only request timestamps and an in-flight flag under that identifier. It never stores the API key, problem, code, supplemental input, prompt, or model response.

The guard rejects a second simultaneous request with HTTP 409 and a clear Chinese message. It rejects the fourth request inside a rolling 60-second window with HTTP 429 and a clear Chinese message. A rejected concurrent request does not consume one of the three rate-limit slots. State is pruned after inactivity to avoid unbounded memory growth.

This is deliberately an in-memory MVP implementation because `MVP.md` forbids a database. It is reliable within one running server instance. A future multi-instance deployment will require shared ephemeral storage; that is outside this stage and must not be presented as globally distributed protection.

## Model Retry

Both invalid JSON and schema-invalid JSON count as an invalid model structure. The server performs at most one full retry. If the second attempt is invalid JSON or schema-invalid, the response is the existing unified `INVALID_MODEL_RESPONSE` failure. Network, authentication, timeout, configuration, empty-response, and non-JSON HTTP transport failures are not retried.

## Supplemental Input

Before analysis, a compact “补充信息（可选）” control is shown below the code editor. It is collapsed on every fresh page load. Expanding it reveals the existing “我的思路或卡点” and failure-case inputs without changing their limits or values. Collapsing it never clears entered text. Validation errors in any supplemental field automatically expand the section so the user can see and correct them.

The post-analysis view remains unchanged and continues to provide the existing collapsible supplemental summary.

## Deployment Timeout

The Next.js analysis route exports a maximum duration above 61 seconds so the application, rather than the host, can return the intended DeepSeek timeout message. Current Vercel Fluid compute supports this duration on Hobby; deployments with Fluid compute disabled retain a 60-second Hobby ceiling and cannot satisfy the frozen behavior. Deployment documentation must make that runtime requirement explicit.

## Verification

- Focused tests prove the request guard allows three requests, rejects the fourth, releases the in-flight lock, and does not store request content.
- Route tests prove server responses use 409/429 and invalid JSON is retried exactly once.
- A page-structure test proves supplemental input is collapsed by default and exposes an accessible expansion control.
- Existing full tests, lint, and production build must pass.

## Self-review

- No placeholders or undecided behavior remain.
- The design preserves the frozen schema and all existing input limits.
- The in-memory limitation is explicit and consistent with the no-database MVP constraint.
- No code execution, authentication, history, billing, or unrelated UI work is included.
