# Visual Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Offsite-inspired landing page, an interactive three-tab product introduction, and move the existing analyzer to `/analyze` without changing its business behavior.

**Architecture:** Shared route and diagnostic content live in a small typed module. Reusable brand navigation and logo components establish the visual system. The landing and explore routes are new client experiences, while the existing analyzer is moved intact into its own route and receives only visual-shell changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner.

---

### Task 1: Freeze navigation and diagnostic content

**Files:**
- Create: `tests/site-content.test.mts`
- Create: `src/lib/site-content.ts`
- Modify: `package.json`

- [ ] Write tests asserting the three public routes and the exact diagnostic labels.
- [ ] Run `node --test tests/site-content.test.mts` and verify it fails because the module is missing.
- [ ] Add typed route and diagnostic content constants.
- [ ] Add `test:site` to package scripts and rerun until it passes.

### Task 2: Build shared brand shell

**Files:**
- Create: `src/components/brand-mark.tsx`
- Create: `src/components/site-header.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] Add the `Think` script mark and full product-name lockup.
- [ ] Add a centered floating header with a functional navigation drawer.
- [ ] Define the warm neutral palette, typography roles, focus styles, responsive rules, and reduced-motion behavior.
- [ ] Update global metadata for the new entry experience.

### Task 3: Build the landing route

**Files:**
- Replace: `src/app/page.tsx`
- Add asset: `public/editorial-thinking-studio.png`

- [ ] Build the restrained hero with oversized editorial title, mono eyebrow, lower-left product explanation, and lower-right journey preview.
- [ ] Link the primary journey to `/explore`.
- [ ] Add subtle load and hover motion only.
- [ ] Verify desktop and mobile composition in the browser.

### Task 4: Build the core diagnostic introduction

**Files:**
- Create: `src/app/explore/page.tsx`
- Create: `src/components/diagnostic-explorer.tsx`

- [ ] Render the three frozen diagnostic labels as accessible tabs.
- [ ] Populate each tab with realistic, product-specific example content.
- [ ] Make tab switching, keyboard focus, and the `/analyze` call to action functional.
- [ ] Verify the tab interaction in the browser.

### Task 5: Move and restyle the analyzer

**Files:**
- Create: `src/app/analyze/page.tsx`
- Remove old analyzer implementation from: `src/app/page.tsx`

- [ ] Move the current form state, validation, request, and API Key behavior without changing logic.
- [ ] Apply the shared brand header and restrained workspace styling.
- [ ] Preserve all field labels, limits, supplemental fields, loading states, and error messages.
- [ ] Verify the main submission flow without persisting or logging the API Key.

### Task 6: Visual QA and verification

**Files:**
- Create: `design-qa.md`

- [ ] Run `npm run test:site`.
- [ ] Run all existing test scripts.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start the local app and capture `/`, `/explore`, and `/analyze` at desktop and mobile sizes.
- [ ] Compare the landing page against the supplied Offsite screenshot at a matching desktop viewport.
- [ ] Fix all P0/P1/P2 issues and record the passing QA result.
