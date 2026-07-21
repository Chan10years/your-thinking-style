# Long-Running DeepSeek Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let difficult DeepSeek V4 Pro analyses use one shared 270-second processing budget and return reliably within Vercel Hobby's 300-second function limit.

**Architecture:** `src/lib/deepseek.ts` handles one bounded DeepSeek transport attempt and maps aborts accurately. `src/app/api/analyze/route.ts` owns one absolute deadline shared by the initial request and the existing schema retry. The UI keeps the current atomic result flow while giving users clear multi-minute loading and timeout feedback.

**Tech Stack:** Next.js 16 App Router, TypeScript, native Fetch/AbortController, Zod, Node test runner.

## Global Constraints

- Route maximum duration is exactly 300 seconds.
- All DeepSeek attempts for one browser analysis share exactly 270,000 milliseconds.
- DeepSeek model remains `deepseek-v4-pro` with thinking explicitly enabled and reasoning effort `high`.
- No API Key, prompt, source code, model response, or raw error object is logged or persisted.
- The frozen `analysisResponseSchema`, one-retry rule, rate limit, and single-in-flight rule remain unchanged.
- Existing user changes in the dirty worktree must be preserved; implementation files must not be committed as a bundle with unrelated existing changes.

---

### Task 1: Correct DeepSeek transport timeout behavior

**Files:**
- Modify: `src/lib/deepseek.ts`
- Modify: `tests/analyze-route.test.ts`

**Interfaces:**
- Produces: `DEEPSEEK_TIMEOUT_MS = 270_000`
- Produces: `requestDeepSeekAnalysis(apiKey: string, prompt: string, timeoutMs?: number)`
- Produces: DeepSeek request body fields `thinking: { type: "enabled" }` and `reasoning_effort: "high"`

- [ ] **Step 1: Write a failing response-body abort regression test**

Add a test that replaces `globalThis.fetch` with an otherwise successful response whose `json()` promise rejects only after the request signal aborts. Call `requestDeepSeekAnalysis("sk-redacted", "prompt", 5)` and assert the thrown `DeepSeekError.code` is `DEEPSEEK_TIMEOUT`, not `DEEPSEEK_INVALID_RESPONSE`.

```ts
test("classifies an abort while reading a successful response body as a timeout", async () => {
  globalThis.fetch = async (_input, init) => ({
    ok: true,
    json: () =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  }) as Response;

  await assert.rejects(
    requestDeepSeekAnalysis("sk-redacted", "prompt", 5),
    (error: unknown) =>
      error instanceof DeepSeekError && error.code === "DEEPSEEK_TIMEOUT",
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:api`

Expected: FAIL because the current function has no third timeout argument and maps the body-read abort to `DEEPSEEK_INVALID_RESPONSE`.

- [ ] **Step 3: Add explicit reasoning request assertions**

Extend the existing V4 Pro request-body test to require:

```ts
assert.deepEqual(requestBodies[0].thinking, { type: "enabled" });
assert.equal(requestBodies[0].reasoning_effort, "high");
```

- [ ] **Step 4: Implement the bounded transport attempt**

Change the default constant to `270_000`, accept `timeoutMs = DEEPSEEK_TIMEOUT_MS`, pass explicit thinking fields in the request body, and check `controller.signal.aborted` inside the `response.json()` catch before mapping the error.

```ts
export const DEEPSEEK_TIMEOUT_MS = 270_000;

export async function requestDeepSeekAnalysis(
  apiKey: string,
  prompt: string,
  timeoutMs = DEEPSEEK_TIMEOUT_MS,
) {
  // existing setup
}
```

The timeout message is:

```text
DeepSeek 深度分析超过 4 分 30 秒，请稍后重试或减少输入内容。
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm run test:api`

Expected: all API tests pass, including the response-body abort regression and explicit thinking request assertions.

---

### Task 2: Share one deadline across schema retries

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `tests/analyze-route.test.ts`
- Modify: `tests/deployment-config.test.mts`

**Interfaces:**
- Consumes: `DEEPSEEK_TIMEOUT_MS` and `requestDeepSeekAnalysis(..., timeoutMs)` from Task 1
- Produces: `export const maxDuration = 300`
- Produces: both model attempts consume the remaining time from one absolute deadline

- [ ] **Step 1: Write a failing shared-budget test**

Use immediate mocked DeepSeek responses, stub `Date.now()` so the first invalid response consumes 20,000 milliseconds, and capture the delays passed to `setTimeout`. Require the first attempt to receive `270_000` and the retry to receive `250_000`, proving it did not receive a fresh full budget.

```ts
assert.deepEqual(capturedTimeouts, [270_000, 250_000]);
```

- [ ] **Step 2: Update deployment assertions and verify RED**

Require the route source to export `maxDuration = 300`, the DeepSeek source to export `DEEPSEEK_TIMEOUT_MS = 270_000`, and the route duration to remain greater than the model budget in seconds.

Run: `npm run test:api && npm run test:deployment`

Expected: FAIL because the current route still exports 65 and starts each retry with an independent default timeout.

- [ ] **Step 3: Implement the absolute deadline**

Import `DEEPSEEK_TIMEOUT_MS`, create one deadline immediately before the first attempt, and pass `Math.max(1, deadline - Date.now())` to each attempt.

```ts
const analysisDeadline = Date.now() + DEEPSEEK_TIMEOUT_MS;

function remainingAnalysisBudget(deadline: number) {
  return Math.max(1, deadline - Date.now());
}
```

Update `requestAndValidateAnalysis` to accept `timeoutMs` and forward it to `requestDeepSeekAnalysis`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:api && npm run test:deployment`

Expected: all focused API and deployment tests pass; timeout capture proves the second attempt only receives the remaining budget.

---

### Task 3: Give clear long-analysis feedback and align product documents

**Files:**
- Modify: `src/app/analyze/page.tsx`
- Modify: `tests/deployment-config.test.mts`
- Modify: `MVP.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Produces: submit label `深度分析中，可能需要几分钟…`
- Produces: consistent 270/300-second requirements across source and documentation

- [ ] **Step 1: Write a failing loading-copy test**

Read `src/app/analyze/page.tsx` and require it to include `深度分析中，可能需要几分钟…` in the submitting branch.

Run: `npm run test:deployment`

Expected: FAIL because the current label is only `分析中…`.

- [ ] **Step 2: Implement the minimal loading-copy change**

Replace the first-analysis submitting label with `深度分析中，可能需要几分钟…` and the reanalysis label with `重新深度分析中，可能需要几分钟…`. Keep the existing disabled state and request lifecycle unchanged.

- [ ] **Step 3: Align the authoritative documents**

In `MVP.md`, replace both 61-second requirements with a 270-second shared DeepSeek budget and state that retries do not reset the deadline. In `DEPLOYMENT.md`, replace 65/61-second guidance with the 300/270-second design and document the Fluid Compute requirement for free Hobby deployment.

- [ ] **Step 4: Run focused tests and terminology checks**

Run: `npm run test:deployment`

Run: `rg -n "61 秒|61-second|65 seconds|65 秒" MVP.md DEPLOYMENT.md src tests`

Expected: deployment tests pass and the search returns no stale production requirement.

---

### Task 4: Full verification and acceptance

**Files:**
- Verify only: all changed files

**Interfaces:**
- Consumes: completed Tasks 1-3
- Produces: evidence that the long-running analysis path is safe to hand off

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run code-quality verification**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0 and `/api/analyze` builds successfully.

- [ ] **Step 4: Verify secret handling and the final diff**

Run: `rg -n "console\.(log|error).*apiKey|localStorage.*apiKey|sessionStorage.*apiKey" src tests`

Run: `git diff --check`

Expected: no API Key persistence/logging match and no whitespace errors.

- [ ] **Step 5: Run browser acceptance with a delayed mocked analysis response**

Start the local app, execute the existing browser acceptance harness with its mocked `/api/analyze` response delayed briefly, and verify the long-analysis label remains visible until the structured result renders. This validates waiting behavior without spending a real DeepSeek API Key or waiting 270 seconds.

Expected: the button is disabled with the long-analysis copy while pending, then the diagnostic workspace renders after the mock resolves.

## Plan Self-Review

- Every confirmed design requirement maps to a task and an exact verification command.
- No placeholders or unrelated refactors are included.
- Task 1 defines the timeout-aware transport interface consumed by Task 2.
- Task 2 keeps the complete retry path inside one 270-second budget.
- Task 3 updates the authoritative MVP requirement instead of leaving a documentation conflict.
- Task 4 explicitly verifies API Key handling, tests, lint, build, and browser waiting behavior.
