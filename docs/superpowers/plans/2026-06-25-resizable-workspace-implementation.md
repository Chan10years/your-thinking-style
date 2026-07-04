# Resizable Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three persistent, accessible draggable separators to the existing pre-analysis workspace.

**Architecture:** Replace the three CSS Grid boundaries with nested `react-resizable-panels` groups while keeping controlled form state in the page component. Store validated completed layouts in one localStorage record and expose an imperative Monaco layout method for resize completion.

**Tech Stack:** Next.js, React, TypeScript, Tailwind/global CSS, Monaco Editor, react-resizable-panels.

---

### Task 1: Layout configuration

**Files:**
- Modify: `src/lib/workspace-config.ts`
- Test: `tests/workspace-config.test.mts`

- [ ] Add failing tests for the requested defaults, storage key, valid parsing, and invalid-value fallback.
- [ ] Run `npm run test:workspace` and confirm the new assertions fail.
- [ ] Add typed defaults and a defensive layout parser.
- [ ] Run `npm run test:workspace` and confirm it passes.

### Task 2: Resizable groups

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/analyze/page.tsx`

- [ ] Install `react-resizable-panels`.
- [ ] Replace the three Grid boundaries with nested `Group`, `Panel`, and `Separator` components.
- [ ] Apply requested defaults and pixel minimum sizes.
- [ ] Persist completed layouts under the project-prefixed key.
- [ ] Keep every input controlled by the existing parent form state.

### Task 3: Monaco and divider presentation

**Files:**
- Modify: `src/components/code-editor.tsx`
- Modify: `src/app/globals.css`

- [ ] Expose `layout()` from the existing Monaco wrapper without remounting it.
- [ ] Trigger layout during and after panel size changes.
- [ ] Style an 8px hit target with a 1px neutral rule and dark hover/drag states.
- [ ] Align the lower panel headers and preserve the existing failure tabs.
- [ ] Stack and disable resizing on narrow screens.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Verify all three separators and their minimum sizes in Chrome.
- [ ] Verify Monaco resize, retained input, refresh persistence, double-click reset, and responsive layout.
- [ ] Confirm no API Key persistence and no changes to analysis behavior.

