# Post-analysis Docking Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the post-analysis three-column result workspace and a lightweight docking AI diagnostic area for the three required diagnostic modules.

**Architecture:** Keep request and input state in `src/app/analyze/page.tsx`, then extract post-analysis rendering into focused components. Stage 5A renders stable three-column results from `AnalysisResponse`; Stage 5B wraps the three diagnostic modules in a third-column-only docking layout with in-memory layout state and a reset action.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind/global CSS, Monaco Editor, Zod analysis types, and a React docking library selected during Stage 5B evaluation.

---

## File Structure

Expected implementation files:

* Modify `src/app/analyze/page.tsx`: store `AnalysisResponse`, switch between pre-analysis and post-analysis workspaces, clear stale results when inputs change.
* Create `src/components/analysis-result-workspace.tsx`: fixed post-analysis outer three-column shell.
* Create `src/components/analysis-result-code-panel.tsx`: read-only user code column for Stage 5, with Stage 6 annotation seam.
* Create `src/components/supplemental-summary.tsx`: collapsible original supplemental input summary.
* Create `src/components/diagnostic-dock-workspace.tsx`: Stage 5B docking container, default layout, reset action, in-memory layout state.
* Create `src/components/diagnostic-panels/thought-restoration-panel.tsx`: `thoughtRestoration` renderer.
* Create `src/components/diagnostic-panels/error-explanation-panel.tsx`: `redErrors`, `redErrorsUnavailableReason`, and `suspectedIssues` renderer.
* Create `src/components/diagnostic-panels/fix-direction-panel.tsx`: `fixDirection` renderer with folded reference code.
* Create `src/lib/analysis-display.ts`: stable Chinese labels and small display helpers.
* Create `src/lib/diagnostic-dock-layout.ts`: diagnostic panel ids, default layout, reset helpers, invalid layout fallback.
* Create `tests/analysis-display.test.mts`: display label and fallback tests.
* Create `tests/diagnostic-dock-layout.test.mts`: default layout and reset tests.
* Modify `src/app/globals.css`: post-analysis three-column and docking styles.
* Modify `package.json` and lockfile only if Stage 5B chooses a docking dependency.

---

### Task 1: Analysis Display Helpers

**Files:**
* Create: `tests/analysis-display.test.mts`
* Create: `src/lib/analysis-display.ts`
* Modify: `package.json`

- [ ] **Step 1: Write tests for required labels**

Create `tests/analysis-display.test.mts` with assertions for:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getAchievableLevelLabel,
  getAnalysisBasisLabel,
  getConfidenceLabel,
  getEvidenceSourceLabel,
  getRedErrorTypeLabel,
  getThoughtStatusLabel,
} from "../src/lib/analysis-display";

test("maps thought restoration status labels", () => {
  assert.equal(getThoughtStatusLabel("thought_flawed"), "思路本身有问题");
  assert.equal(getThoughtStatusLabel("implementation_bug"), "思路大体可行，实现出现错误");
  assert.equal(getThoughtStatusLabel("thought_code_mismatch"), "用户描述的思路与代码实现不一致");
  assert.equal(getThoughtStatusLabel("insufficient_information"), "信息不足，无法可靠判断用户思路");
});

test("maps evidence and metadata labels", () => {
  assert.equal(getEvidenceSourceLabel("failure_case"), "失败样例支持");
  assert.equal(getEvidenceSourceLabel("static_analysis"), "静态分析");
  assert.equal(getEvidenceSourceLabel("insufficient_evidence"), "证据不足");
  assert.equal(getAnalysisBasisLabel("problem"), "题目");
  assert.equal(getAnalysisBasisLabel("code"), "代码");
  assert.equal(getAnalysisBasisLabel("user_thought"), "用户思路");
  assert.equal(getAnalysisBasisLabel("failure_case"), "失败信息");
});

test("maps fix path labels", () => {
  assert.equal(getConfidenceLabel("high"), "高");
  assert.equal(getConfidenceLabel("medium"), "中");
  assert.equal(getConfidenceLabel("low"), "低");
  assert.equal(getAchievableLevelLabel("understanding_only"), "只能帮助理解");
  assert.equal(getAchievableLevelLabel("partial_data"), "只能通过部分数据");
  assert.equal(getAchievableLevelLabel("full_ac_non_optimal"), "可以完整通过，但不是最优");
  assert.equal(getAchievableLevelLabel("full_ac"), "可以完整通过");
});

test("maps red error type labels", () => {
  assert.equal(getRedErrorTypeLabel("syntax_or_compile_error"), "语法或编译级错误");
  assert.equal(getRedErrorTypeLabel("hard_requirement_violation"), "题意硬约束违背");
  assert.equal(getRedErrorTypeLabel("boundary_case_error"), "边界条件必错");
  assert.equal(getRedErrorTypeLabel("logic_error"), "算法逻辑必错");
  assert.equal(getRedErrorTypeLabel("runtime_failure_risk"), "运行时必错风险");
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/analysis-display.test.mts`

Expected: FAIL because `src/lib/analysis-display.ts` does not exist.

- [ ] **Step 3: Add the display helper module**

Implement `src/lib/analysis-display.ts` using exhaustive records keyed by schema enum values imported from `src/types/analysis`.

- [ ] **Step 4: Add and run a script**

Add `"test:display": "node --test tests/analysis-display.test.mts"` to `package.json` and include it in `"test"`.

Run: `npm run test:display`

Expected: PASS.

---

### Task 2: Stage 5A Result State and Shell

**Files:**
* Modify: `src/app/analyze/page.tsx`
* Create: `src/components/analysis-result-workspace.tsx`
* Create: `src/components/analysis-result-code-panel.tsx`
* Create: `src/components/supplemental-summary.tsx`

- [ ] **Step 1: Store analysis data on success**

In `src/app/analyze/page.tsx`, import `AnalysisResponse` and add:

```ts
const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
```

When `/api/analyze` returns `{ success: true, data }`, save `payload.data` and set `submitState` to `"success"`.

- [ ] **Step 2: Clear stale results when input changes**

Inside `updateField`, when any input changes and the state is not submitting, clear `analysisResult` and remove the old success message. This prevents old diagnosis from appearing with new inputs.

- [ ] **Step 3: Extract post-analysis shell**

Create `AnalysisResultWorkspace` with props:

```ts
type AnalysisResultWorkspaceProps = {
  input: AnalysisInput;
  analysis: AnalysisResponse;
  theme: "light" | "dark";
  onBackToEditing: () => void;
  onResetDiagnosticLayout?: () => void;
};
```

It renders the fixed three columns:

* 原始题目.
* 用户代码.
* AI 诊断工作区.

- [ ] **Step 4: Add read-only code panel**

Create `AnalysisResultCodePanel` to display the user code in a read-only code surface. Keep the Stage 6 annotation work out of this task.

- [ ] **Step 5: Add supplemental summary**

Create `SupplementalSummary` with a default-collapsed `<details>` block for user thought and any filled failure fields.

- [ ] **Step 6: Render the shell after success**

In `AnalyzePage`, render `AnalysisResultWorkspace` when `analysisResult` is non-null. Keep the API Key value in the parent state only and do not pass it to diagnostic components.

- [ ] **Step 7: Run verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 3: Stage 5A Diagnostic Content Panels

**Files:**
* Create: `src/components/diagnostic-panels/thought-restoration-panel.tsx`
* Create: `src/components/diagnostic-panels/error-explanation-panel.tsx`
* Create: `src/components/diagnostic-panels/fix-direction-panel.tsx`
* Modify: `src/components/analysis-result-workspace.tsx`
* Modify: `src/app/globals.css`

- [ ] **Step 1: Build thought restoration panel**

Render all `thoughtRestoration` fields with the labels from `analysis-display.ts`. Show the “未提供用户思路” wording when the submitted `userThought` is blank.

- [ ] **Step 2: Build error explanation panel**

Render `redErrors` in order. Show the MVP empty state when the array is empty:

```text
未发现可确认的明确错误。当前分析不代表代码一定正确，建议结合测试用例验证。
```

Render `redErrorsUnavailableReason` when it is non-empty. Render `suspectedIssues` as unnumbered auxiliary items.

- [ ] **Step 3: Build fix direction panel**

Render `personalizedPath`, `standardPath`, and `newKnowledgeNeeded` separately. Use `<details>` for every `referenceCode`, with `open` omitted so reference code is folded by default.

- [ ] **Step 4: Wire panels into the result workspace**

For Stage 5A, render the three panels in a simple vertical stack inside the AI diagnostic column. Do not add a fixed three-tab interaction; the final panel organization is handled by Docking in Stage 5B.

- [ ] **Step 5: Run verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 4: Stage 5B Dock Layout Configuration

**Files:**
* Create: `tests/diagnostic-dock-layout.test.mts`
* Create: `src/lib/diagnostic-dock-layout.ts`
* Modify: `package.json`

- [ ] **Step 1: Write default-layout tests**

Create tests asserting:

* The panel ids are `thoughtRestoration`, `errorExplanation`, `fixDirection`.
* Labels are exactly “思路还原”“错误解释”“修正方向”.
* The default layout has one tab group with all three panels in that order.
* Reset returns a fresh default layout object.
* Invalid serialized layout falls back to default.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/diagnostic-dock-layout.test.mts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add layout config module**

Implement constants and helpers:

```ts
export const DIAGNOSTIC_PANEL_IDS = ["thoughtRestoration", "errorExplanation", "fixDirection"] as const;
export const DEFAULT_DIAGNOSTIC_DOCK_LAYOUT = createDefaultDiagnosticDockLayout();
export function createDefaultDiagnosticDockLayout() { /* returns fresh default layout */ }
export function parseDiagnosticDockLayout(input: unknown) { /* validates or falls back */ }
```

Use the target docking library's JSON shape only after the library is selected. Before selection, keep the helper isolated so only this file changes if the library shape differs.

- [ ] **Step 4: Add and run a script**

Add `"test:dock-layout": "node --test tests/diagnostic-dock-layout.test.mts"` and include it in `"test"`.

Run: `npm run test:dock-layout`

Expected: PASS.

---

### Task 5: Stage 5B Docking Library Integration

**Files:**
* Modify: `package.json`
* Modify: `package-lock.json`
* Create: `src/components/diagnostic-dock-workspace.tsx`
* Modify: `src/components/analysis-result-workspace.tsx`
* Modify: `src/app/globals.css`

- [ ] **Step 1: Select and install the docking dependency**

Evaluate `dockview` / `dockview-react` first. If compatible with the current Next.js client component setup, install it.

Run: `npm install dockview dockview-react`

Expected: package and lockfile update successfully.

- [ ] **Step 2: Build `DiagnosticDockWorkspace` as a client component**

The component owns in-memory layout state and receives:

```ts
type DiagnosticDockWorkspaceProps = {
  analysis: AnalysisResponse;
  input: AnalysisInput;
};
```

It renders the three diagnostic modules through the docking library's panel factory.

- [ ] **Step 3: Restrict behavior to Stage 5 scope**

Configure the docking library so:

* Panels cannot close.
* Floating panels are disabled.
* Popout/browser windows are disabled.
* Dragging is constrained to the diagnostic workspace.
* Layout state is not written to localStorage.

- [ ] **Step 4: Add reset default layout**

Add a “恢复默认布局” control in the AI diagnostic workspace header. It calls the docking API or resets component state to `createDefaultDiagnosticDockLayout()`.

- [ ] **Step 5: Replace temporary Stage 5A diagnostic layout**

Replace the simple Stage 5A diagnostic container in `AnalysisResultWorkspace` with `DiagnosticDockWorkspace`.

- [ ] **Step 6: Style the docking surface**

Keep the current workspace visual language:

* Fine neutral separators.
* Compact tab labels.
* No floating cards inside cards.
* No decorative gradients.
* Dark and light theme compatibility.

- [ ] **Step 7: Run verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 6: Browser Verification

**Files:**
* Update: `design-qa.md`

- [ ] **Step 1: Start the app**

Run: `npm run dev`

Expected: local app starts without build errors.

- [ ] **Step 2: Verify Stage 5A flow**

Submit a mocked or real successful analysis flow and confirm:

* The page switches to 原始题目 / 用户代码 / AI 诊断工作区.
* The old fixed success toast is no longer the only result.
* Thought restoration, error explanation, fix direction, and new knowledge render.
* Reference code is folded by default.
* Supplemental summary is available.

- [ ] **Step 3: Verify Stage 5B docking**

Inside the third column, confirm:

* Tags reorder by drag.
* A module can merge into another tab group.
* A module can dock above, below, left, and right.
* Splitters resize groups.
* “恢复默认布局” restores the original single tab group.
* Refreshing the page does not restore the previous custom layout.
* Panels cannot close, float, pop out, or leave the third column.

- [ ] **Step 4: Verify safety**

Search source for API Key persistence and logging:

Run: `rg "localStorage|sessionStorage|apiKey|API Key|console\\." src tests`

Expected: theme/workspace non-secret persistence may appear; API Key must not be persisted, logged, or passed into diagnostic components.

- [ ] **Step 5: Record QA**

Update `design-qa.md` with viewport, state, findings, and whether Stage 5A/5B passed.

---

## Self-review

Spec coverage:

* 5A three-column result page: Tasks 2 and 3.
* Full diagnostic content rendering: Task 3.
* 5B docking sort/merge/split/resize/reset: Tasks 4 and 5.
* Session-only layout state: Task 5.
* No Monaco red/blue annotations or click linkage: Tasks 2 and 6 explicitly keep them out.
* API Key safety: Task 6.

Placeholder scan:

* No task relies on “implement later” language for required Stage 5 behavior.
* The only deferred behavior is explicitly out of Stage 5 scope and assigned to Stage 6.

Type consistency:

* Component props consistently use `AnalysisInput` and `AnalysisResponse`.
* Diagnostic panel ids are centralized in `diagnostic-dock-layout.ts`.
