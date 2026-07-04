# Resizable Workspace Design

## Scope

Add draggable sizing to the existing pre-analysis workspace without changing
form fields, validation, API key handling, analysis requests, server code, or
the analysis result experience.

## Layout

Use `react-resizable-panels` 4.x for three nested groups:

- Main horizontal group: problem 45%, workspace 55%.
- Right vertical group: code 60%, supplemental inputs 40%.
- Supplemental horizontal group: thought 45%, failure case 55%.

Panels use pixel minimums so the requested editor dimensions remain useful:

- Problem: 320px.
- Right workspace: 480px.
- Code: 260px.
- Supplemental inputs: 180px.
- Thought: 240px.
- Failure case: 280px.

At widths below 1080px, the supplemental group stacks vertically. At widths
below 760px, all groups stack vertically and separators are disabled and
hidden.

## Interaction and Persistence

Each separator uses the library's accessible separator semantics and keyboard
handling. The visual rule remains 1px while its hit target is 8px. Hover and
drag states darken the rule without introducing color.

The library's built-in separator double-click behavior restores the adjacent
panels to their declared default sizes. Completed layouts are persisted as one
validated object in `localStorage` under
`yourthinkingstyle.workspace.layout`. Invalid or incomplete values fall back
to the three default ratios.

## Monaco

Keep one Monaco instance mounted while resizing. Continue using
`automaticLayout`, expose an imperative `layout()` handle from the editor
wrapper, and call it after relevant layout changes complete.

## Visual Alignment

The two lower panels share the same top edge, title-bar height, counter
baseline, and divider rhythm. The failure tabs remain a second row inside only
the failure panel, matching the supplied reference without altering their
state model.

## Verification

Cover layout parsing and defaults with unit tests. Run the full project tests,
lint, and production build. In Chrome, verify drag constraints, Monaco sizing,
input retention, refresh persistence, double-click reset, and responsive
stacking.

