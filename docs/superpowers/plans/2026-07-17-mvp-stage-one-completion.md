# MVP Stage One Completion Implementation Plan

> **Status: historical and not executable for current work.** This plan documents
> a completed no-database MVP stage. Its 61-second timeout and deployment notes
> have since been superseded. Follow
> [the current backend implementation plan](2026-08-07-hosted-backend-implementation.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five approved MVP stage-one gaps without adding a database, account system, or unrelated feature.

**Architecture:** Add a focused in-memory browser-session request guard used by the existing analysis route, then adjust route retry handling and the existing pre-analysis supplemental UI. Keep the frozen analysis schema and current result workspace unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node test runner, Zod, Vercel configuration.

## Global Constraints

- MVP supports C++ only.
- DeepSeek timeout remains exactly 61,000 milliseconds.
- One browser session may have one in-flight request and at most three started requests in a rolling 60-second window.
- API keys, inputs, prompts, and model responses must not be stored by the request guard or written to logs.
- No database or new dependency may be added.
- The frozen `mvp-1` response schema must not change.

---

### Task 1: Browser-session request guard

**Files:**
- Create: `src/lib/analysis-request-guard.ts`
- Create: `tests/analysis-request-guard.test.ts`
- Modify: `src/lib/analysis-submit.ts`
- Modify: `tests/reanalysis.test.mts`

**Interfaces:**
- Produces: `createAnalysisRequestGuard()` with `begin(sessionId: string, now?: number): AnalysisRequestDecision` and `finish(sessionId: string): void`.
- Produces: an `x-analysis-session-id` header created synchronously before the first browser request.

- [ ] Write tests for three accepted starts, a fourth rate-limited start, concurrent rejection, lock release, and stale-state pruning.
- [ ] Run `npm.cmd exec -- tsx --test tests/analysis-request-guard.test.ts` and confirm failures because the module does not exist.
- [ ] Implement the minimal timestamp-and-lock state machine without retaining request content.
- [ ] Add a client submission test requiring one stable opaque session identifier and implement session-cookie creation before `fetch`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Route protection and invalid-JSON retry

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `tests/analyze-route.test.ts`

**Interfaces:**
- Consumes the request guard from Task 1.
- Produces a session cookie named `your-thinking-style-session`, 409 `ANALYSIS_IN_PROGRESS`, and 429 `RATE_LIMIT_EXCEEDED` responses.

- [ ] Add route tests that send a stable session cookie and verify concurrent and fourth-request failures.
- [ ] Change the existing invalid-JSON test to require one retry and add a two-invalid-attempt failure case.
- [ ] Run `npm.cmd run test:api` and confirm the new assertions fail for the missing behavior.
- [ ] Acquire the guard after input validation, attach the cookie to every guarded response, and release the lock in `finally`.
- [ ] Treat first-attempt JSON parse failure like schema failure and return unified `INVALID_MODEL_RESPONSE` only after the second invalid attempt.
- [ ] Re-run route and guard tests and confirm they pass.

### Task 3: Collapsed supplemental input

**Files:**
- Modify: `src/app/analyze/page.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/supplemental-collapse.test.mts`
- Modify: `package.json`

**Interfaces:**
- Produces an accessible `aria-expanded` control labeled `补充信息（可选）`.
- Preserves the existing supplemental field IDs, limits, tabs, and state values.

- [ ] Add a source-structure regression test requiring collapsed initial state, an expansion control, conditional supplemental rendering, and automatic expansion on supplemental validation errors.
- [ ] Run the focused test and confirm it fails against the current always-visible layout.
- [ ] Add local component state and the compact expansion row; render the existing supplemental group only while expanded.
- [ ] Automatically expand after validation finds a supplemental error.
- [ ] Add only the CSS needed for the compact row and expanded content.
- [ ] Add the focused test to the aggregate test script and confirm it passes.

### Task 4: Deployment timeout alignment and documentation

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `DEPLOYMENT.md`
- Create: `tests/deployment-config.test.mts`
- Modify: `package.json`

**Interfaces:**
- Produces a Next.js `/api/analyze` maximum duration greater than 61 seconds.

- [ ] Add a configuration test requiring a duration greater than 61 seconds for the analysis route and documentation of the Fluid compute requirement.
- [ ] Run the focused test and confirm it fails against the current configuration.
- [ ] Configure the analysis route duration to 65 seconds and document that Hobby supports it with Fluid compute enabled, while legacy non-Fluid Hobby does not.
- [ ] Add the focused test to the aggregate test script and confirm it passes.

### Task 5: Full verification

**Files:**
- Review all modified files and `git diff`.

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run lint` and require exit code 0.
- [ ] Run `npm.cmd run build` and require exit code 0.
- [ ] Confirm `git diff` contains no API key, unrelated feature, schema change, or dependency addition.
- [ ] Report each stage-one requirement with its evidence and give the user simple manual acceptance steps.

## Plan self-review

- Every approved gap maps to a task.
- Function names and response codes are consistent across tasks.
- No placeholder steps or speculative features remain.
- The plan preserves the no-database constraint and explicitly documents the single-instance limitation.
