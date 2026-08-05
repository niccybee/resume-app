# CV Builder Workbench Redesign

Status: Implemented; final live responsive verification remains in #74
Branch: `design/csv-builder-redesign`

## Purpose

Redesign the CV Builder around the user’s active Working Composition while preserving Resume Studio’s existing domain contracts, explicit Change Proposal review, and editorial visual language.

## Current experience

The current `/app/cvs/new` surface presents CV details, theme selection, generation tools, the CV Block Library, Working Composition controls, live preview, Editing Session lifecycle actions, copying, publishing, and Revision history in one long page. The feature set is broad, but the primary task and next action are not consistently dominant.

## Decisions

### The builder is a workbench

The redesigned CV Builder will be an always-available composition workbench, not a rigid step-by-step wizard.

Users must be able to move repeatedly between finding CV Blocks, changing the Working Composition, and evaluating the rendered CV. Setup and review may use progressive disclosure, but they must not lock the user into a linear sequence.

### The Working Composition is the centre

The desktop workbench uses three layers of responsibility:

- The CV Block Library is a narrow supporting rail for finding and adding exact Block Versions.
- The Working Composition is the widest permanent surface and the visual centre of the page.
- The live CV preview is hidden until requested, then slides over the workbench from the right.

The preview is not a permanent third column. A persistent **Preview CV** action opens it without navigating away or losing composition context.

The approved visual direction is captured in [the workbench mockup](../screenshots/cv-builder-workbench-direction.png).

### The preview drawer is resizable

On desktop, the live CV preview opens at approximately 44% of the available workbench width. The user may resize it within limits that keep both the A4 preview and the obscured workbench legible. The drawer retains its last width for the current browser session.

On narrow viewports, the preview becomes a full-screen sheet. It provides an explicit close action, closes with Escape where a hardware keyboard is available, traps focus while open, and restores focus to **Preview CV** when closed.

### Adding a CV Block is explicit

Each eligible CV Block in the library has a visible **Add** action. Dragging a CV Block into the Working Composition may be offered as a faster pointer interaction, but it is not the only way to add content.

Keyboard and assistive-technology users must be able to add the same exact Block Version and receive equivalent success or error feedback without drag-and-drop.

### Add defaults to the latest Block Version

Adding a CV Block selects its latest Block Version by default. The selected version remains visible on the library result and in the Working Composition rather than being hidden behind an implicit “current” label.

The user may choose an older Block Version before adding the CV Block or replace the selected version afterward. The Working Composition continues to persist an exact Block Version reference.

### Working Composition changes autosave

Routine Working Composition changes autosave into the active Editing Session. This includes adding, removing, replacing, reordering, and regrouping selected Block Versions.

The workbench header always exposes one compact persistence state: **Saving…**, **Saved**, or **Conflict — review changes**. Failures provide a recovery action and never imply that unsaved work is durable. Conflict recovery refreshes the active Editing Session context without silently overwriting either state.

Autosave does not make consequential actions implicit. Finishing a CV Revision, applying a Change Proposal, copying, publishing, withdrawing publication, archiving, and restoring remain explicit user actions.

### Generation tools are summoned, not persistent

The CV Block Library ends with a restrained **Draft from notes** action. Activating it opens a focused modal on desktop and a sheet on narrow viewports. The generation interface does not permanently consume workbench space.

Generated CV Blocks remain proposals until reviewed and explicitly applied. The review surface explains what will be created, supports correction and selective acceptance where the proposal contract permits it, and keeps the Working Composition unchanged until apply succeeds.

### Publication and Revision history leave the workbench

The workbench represents one active Editing Session. It keeps **Finish Revision** visible, but it does not contain the full immutable Revision history or publication controls.

Finishing returns the user to, or offers a direct route to, the CV overview. That overview owns Revision history, Published Revision selection, rollback to an older Revision, public-link management, and withdrawal of publication.

### Secondary Editing Session actions use a dropdown

The workbench header permanently exposes **Preview CV** and **Finish Revision**. A clearly labelled **Editing Session actions** dropdown contains **Copy to New Version**, **Copy for New Role**, and **Archive Editing Session**.

Selecting a dropdown item opens the appropriate review, input, or confirmation surface. No consequential action occurs merely by selecting a menu item. Destructive archival is visually separated from copy actions and uses explicit confirmation.

### Working Composition sections collapse independently

Experience, Education, Skills, Certifications, Interests, and any future supported composition sections have independent collapse controls. Multiple sections may remain open; this is not a single-open accordion.

Experience opens by default because it is normally the primary composition task. Other populated sections begin collapsed, while empty sections remain compact. Expansion state is remembered for the active Editing Session in the current browser session.

### The CV Block Library adapts around the composition

The CV Block Library is open by default on wide desktop layouts and may collapse to a compact **Add CV Blocks** control. The current browser session remembers the user’s choice.

On tablet layouts, the library becomes a slide-in surface. On mobile, it becomes a full-screen selection sheet. Opening and closing it preserves the user’s position and focus in the Working Composition.

### Cross-section placement remains available

This redesign does not remove the existing ability to place a selected CV Block in another document section. The capability remains available while the broader composition semantics are left unchanged.

Experience Blocks continue to retain their Employment Occasion relationship even when presentation placement changes. The redesign must not imply that moving presentation position changes the Block’s underlying kind or Employment Occasion.

The control is disclosed as **Move to section…** inside the selected Block’s overflow menu rather than shown persistently on every row. The current section remains visible through the Block’s surrounding section and accessible name.

### Reordering uses dedicated drag handles

The Working Composition uses [`@dnd-kit/vue`](https://dndkit.com/vue/quickstart/) for sortable interaction, subject to the Nuxt SSR and hydration spike defined in [the drag-and-drop research](../research/cv-builder-drag-and-drop.md). `vue-draggable-plus` is the fallback if that spike fails.

Only a visible handle activates pointer dragging; selecting text and using row controls must not begin a drag. Pointer, touch, and keyboard interactions commit the same domain-level reorder operation. Screen-reader instructions and announcements use the CV Block, employer, and role labels rather than internal IDs.

The overflow menu retains **Move up**, **Move down**, **Move to top**, and **Move to bottom** as single-pointer alternatives to a dragging movement. A successful reorder autosaves once; canceled and unchanged drags do not persist.

AutoAnimate is not the drag engine and is not initially applied to dnd-kit-owned sortable rows. It may later support unrelated disclosure and add/remove motion.

### Experience can be sorted by job date

The Experience section header provides **Sort Experience**. Job-date sorting reorders whole Employment Occasion groups and preserves the user’s manual Experience Block order inside each occasion. It does not move Experience Blocks that the user deliberately placed in another presentation section.

The action writes one autosaved Working Composition change and offers **Undo**. A subsequent manual job reorder changes the displayed ordering state to **Custom**; sorting is an explicit command, not a persistent mode that fights later manual changes.

**Newest job first** is the default job-date direction. **Oldest job first** remains available. Ongoing Employment Occasions sort before completed occasions in newest-first order; partial dates use their available year, month, and day precision with a stable existing-order tie-break.

Job-date sorting operates on Employment Occasions globally rather than forcing all occasions from one employer to remain adjacent. The same employer may therefore appear in multiple chronological positions. Each Employment Occasion keeps its own Experience Blocks together, and their internal order is unchanged by the job sort.

## Constraints already in force

- A Working Composition belongs to an Editing Session and selects exact Block Versions.
- Experience Blocks remain grouped by Employment Occasion.
- Mutating flows that use a Change Proposal must remain explicitly reviewable before apply.
- The existing paper, ink, marker, editorial typography, square geometry, and Lucide icon language remain the visual foundation.
- Compact and standard controls retain the established sizing system unless usability testing demonstrates a reason to change it.
- The workbench must remain usable with keyboard navigation, reduced motion, and narrow viewports.

## Delivery

The approved decisions are delivered through dependency-ordered GitHub issues. Each issue must preserve existing domain behavior and be independently testable or demonstrable.

1. [#67 — Spike accessible `@dnd-kit/vue` sorting in Nuxt 4](https://github.com/niccybee/resume-app/issues/67)
2. [#68 — Establish the CV Builder workbench and adaptive Block Library](https://github.com/niccybee/resume-app/issues/68)
3. [#69 — Autosave Working Composition changes with visible recovery state](https://github.com/niccybee/resume-app/issues/69)
4. [#70 — Add the resizable live CV preview drawer](https://github.com/niccybee/resume-app/issues/70)
5. [#71 — Make the Working Composition sortable and add job-date ordering](https://github.com/niccybee/resume-app/issues/71)
6. [#72 — Move generation and Editing Session actions into focused overlays](https://github.com/niccybee/resume-app/issues/72)
7. [#73 — Move Revision history and publication management to the CV overview](https://github.com/niccybee/resume-app/issues/73)
8. [#74 — Verify and polish the responsive CV Builder workbench](https://github.com/niccybee/resume-app/issues/74)

## Implementation readback

Implemented on 2026-08-05:

- The CV Workbench now uses a persistent header, adaptive Block Library, central Working Composition, independently collapsible sections, and a right-side preview slideover.
- `@dnd-kit/vue` provides handle-only pointer and keyboard sorting for Employment Occasions and their exact Block Versions. Custom accessibility announcements use the employer, role, and Block labels stored with each sortable item.
- Experience can be sorted newest-first or oldest-first as whole Employment Occasions, with stable partial-date handling, preserved Block order, Custom state after manual movement, and one-step Undo.
- Active Editing Sessions autosave routine composition changes with queued optimistic saves and visible Saving, Saved, and Conflict recovery states.
- Draft-from-notes, Copy for New Role, archive confirmation, and Change Proposal review use focused overlays. Secondary Editing Session actions live in the header dropdown.
- `/app/cvs/:cvId/edit` owns the Workbench. `/app/cvs/:cvId` now owns Editing Sessions, immutable Revision history, publishing, rollback, public-link withdrawal, and CV archive/restore.

Verification completed:

- 63 Vitest files and 332 tests pass outside the local-server suite.
- Nuxt typecheck passes.
- Nuxt client and SSR bundles compile successfully with `@dnd-kit/vue` included.

Verification still required in #74:

- The local Nuxt HTTP server accepts a socket but does not return a response, and Nitro's final Rollup packaging remains alive without completing after client and SSR compilation. That prevents an honest hydration, pointer/touch, focus-return, and responsive-browser sign-off in this environment. The implementation is therefore not represented as browser-verified yet.
