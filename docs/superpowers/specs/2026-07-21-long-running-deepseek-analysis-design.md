# Long-Running DeepSeek Analysis Design

## Goal

Allow difficult DeepSeek V4 Pro analyses to run longer than 60 seconds and still return a complete structured result, while keeping deployment compatible with the free Vercel Hobby plan.

## Confirmed Product Decision

- The hosted Next.js analysis function may run for at most 300 seconds.
- One browser analysis request receives a shared DeepSeek processing budget of 270 seconds.
- The remaining 30 seconds are reserved for request parsing, schema validation, response serialization, and platform overhead.
- DeepSeek V4 Pro remains in thinking mode with high reasoning effort because difficult-problem analysis quality is the priority.
- The existing frozen response schema, one-retry rule, request limits, and API Key handling remain unchanged.

This replaces the previous 61-second DeepSeek timeout requirement in `MVP.md` and the related 65-second deployment setting.

## Approaches Considered

### Recommended: one bounded long-running request

Keep the existing browser-to-Next.js-to-DeepSeek request flow, increase the total processing budget to 270 seconds, and configure the route for 300 seconds. Both model attempts share the same deadline, so a fast invalid response may still be retried without allowing the route to exceed the hosting limit.

This is the smallest reliable change, needs no new service or dependency, and fits the current free-hosting target.

### Rejected for this stage: asynchronous job and polling

An asynchronous job could survive beyond a single HTTP request, but it requires durable job state, a queue or workflow service, polling, expiration rules, and new operational costs. It conflicts with the current MVP's no-database shape and is unnecessary for a 270-second target.

### Rejected for this stage: streaming transport

Streaming could expose partial progress but would not extend the Vercel Hobby five-minute execution ceiling. It would also require a new client/server protocol while the product only needs a final structured JSON result. The existing loading state is sufficient if the final result or error is reliable.

## Server Architecture

`src/lib/deepseek.ts` owns one DeepSeek attempt. It accepts an explicit timeout budget, sends V4 Pro with thinking enabled and high reasoning effort, and aborts when that attempt's remaining budget expires. An abort during either the initial fetch or response-body parsing is classified as `DEEPSEEK_TIMEOUT`; malformed successful HTTP content remains `DEEPSEEK_INVALID_RESPONSE`.

`src/app/api/analyze/route.ts` owns the overall request deadline. It starts one 270-second clock before the first model attempt. The first attempt receives the current remaining time. If its model content is invalid JSON or fails schema validation, the second attempt receives only the time still left on the same deadline. Network, authentication, transport, empty-response, configuration, and timeout failures remain non-retryable.

This prevents the existing worst case in which two independent full-duration attempts could exceed the route's hosting budget.

## User Feedback

The existing disabled submit button continues to prevent duplicate submissions. While a request is running, its label states that a deep analysis is in progress and may take several minutes. Success continues to open the structured diagnostic workspace. If 270 seconds elapse, the page receives the existing explicit timeout class with copy that states the analysis exceeded the four-and-a-half-minute limit; it must never be mislabeled as an unparseable response.

No partial model content is displayed because the response schema must be validated atomically before rendering.

## Security and Data Handling

The API Key remains in browser memory and the current request only. No timeout diagnostics may include the API Key, request body, prompt, model response, or raw error object. The change adds no persistence, logging of user content, third-party dependency, or alternate model endpoint.

## Documentation

`MVP.md` and `DEPLOYMENT.md` will replace the frozen 61/65-second statements with the confirmed 270/300-second budget. Deployment guidance will require Vercel Fluid Compute because Hobby projects without it retain a shorter legacy limit.

## Verification

- A regression test reproduces an abort while reading an otherwise successful DeepSeek response body and requires `DEEPSEEK_TIMEOUT`.
- Request-body tests require explicit V4 Pro thinking mode and high reasoning effort.
- Route tests prove a retry receives only the remaining shared deadline instead of a new full timeout.
- Deployment tests require a 300-second route duration and a 270-second DeepSeek budget.
- UI tests require long-analysis loading copy.
- The complete test suite, lint, production build, and a browser-level mocked long-response flow must pass.

## Self-Review

- No placeholder or undecided behavior remains.
- The 270-second model budget is strictly below the 300-second hosting limit.
- Retry behavior cannot multiply the total model budget.
- The response schema and API Key security requirements are unchanged.
- No queue, database, streaming protocol, model switch, or unrelated UI redesign is included.
