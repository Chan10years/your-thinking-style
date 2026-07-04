# Pre-analysis Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current stacked analysis form with a full-height branded editor workspace while preserving all input and request behavior.

**Architecture:** Keep form state and submission in `src/app/analyze/page.tsx`, extract Monaco, theme control, API-key dialog, and failure tabs into focused components, and place pure theme/tab definitions in a tested workspace module. CSS variables drive page and Monaco themes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Monaco Editor, Node test runner.

---

### Task 1: Freeze workspace configuration

**Files:**
- Create: `tests/workspace-config.test.mts`
- Create: `src/lib/workspace-config.ts`
- Modify: `package.json`

- [ ] Test exact theme options, failure-tab field mapping, and 45/55 plus 58/42 ratios.
- [ ] Run the test and confirm failure because the module does not exist.
- [ ] Add typed constants and an aggregate `npm test` script.
- [ ] Run the new test and confirm it passes.

### Task 2: Add Monaco

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/code-editor.tsx`

- [ ] Install `@monaco-editor/react` and `monaco-editor`.
- [ ] Create a controlled C++ editor with light and dark custom themes.
- [ ] Configure low-contrast line numbers, selection, current-line highlight, minimap off, and automatic layout.

### Task 3: Add theme and API Key controls

**Files:**
- Create: `src/components/theme-control.tsx`
- Create: `src/components/api-key-dialog.tsx`

- [ ] Add system/light/dark theme selection and apply `data-theme` to the document.
- [ ] Persist only the theme preference.
- [ ] Add an accessible API Key dialog with password input and memory-only value handling.

### Task 4: Build the workspace layout

**Files:**
- Replace workspace markup in: `src/app/analyze/page.tsx`
- Add workspace styles in: `src/app/globals.css`

- [ ] Preserve the existing form object, validation function, fetch request, success/error parsing, and submit states.
- [ ] Build the 60px toolbar and 45/55 viewport grid.
- [ ] Build the 58/42 right split and 45/55 lower split.
- [ ] Render problem, thought, and failure fields in borderless scrollable panels.
- [ ] Use tabs for failure fields and keep all values in the shared form state.
- [ ] Route API Key errors to the dialog and field errors to their panels.

### Task 5: Align entry wording

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/site-content.ts`

- [ ] Change the homepage primary entry and navigation label to “开始分析”.
- [ ] Keep the homepage layout and brand visuals unchanged.

### Task 6: Verify

**Files:**
- Update: `design-qa.md`

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Search source for API Key persistence and logging.
- [ ] Use Chrome at 1440×900 and a narrow breakpoint to verify layout.
- [ ] Verify light/dark/system theme, Monaco theme sync, failure tabs, API Key dialog, and submit validation.
- [ ] Record unresolved visual or functional issues without committing or pushing.
