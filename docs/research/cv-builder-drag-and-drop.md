# CV Builder drag-and-drop research

Research date: 2026-08-05
Scope: Vue 3.5 / Nuxt 4 reordering for the CV Builder Working Composition

## Recommendation

Use [`@dnd-kit/vue`](https://dndkit.com/vue/quickstart/) for the Working Composition, subject to a short Nuxt SSR and hydration spike before committing the implementation ticket.

It is the best match for this workbench because it provides actual sortable drag-and-drop, a dedicated handle ref, pointer and keyboard sensors, and built-in ARIA instructions and live-region announcements. Its sortable helper supports flat arrays and grouped records, which maps well to sections containing Employment Occasion groups and CV Blocks. The current app already meets its Vue 3.5 minimum ([project package](../../package.json); [`@dnd-kit/vue` quickstart](https://dndkit.com/vue/quickstart/)).

Do **not** install AutoAnimate as the drag engine. AutoAnimate observes DOM additions, removals, and moves and animates them; it does not decide a drop target or update the Working Composition ([official AutoAnimate usage](https://auto-animate.formkit.com/)). Do not initially apply it to the same sortable children either: dnd-kit already owns transforms and sortable transitions, so a second animation system adds avoidable coordination risk. AutoAnimate remains a reasonable later enhancement for non-draggable disclosure or add/remove surfaces, where its automatic `prefers-reduced-motion` handling is useful.

Keep [`vue-draggable-plus`](https://vue-draggable-plus.pages.dev/en/) backed by [SortableJS](https://github.com/SortableJS/Sortable) as the fallback if the dnd-kit spike exposes unacceptable Nuxt issues. It has the lowest implementation cost and the clearest official nested-list example, but neither its API nor SortableJS documents a keyboard sensor, ARIA instructions, or live announcements. Choosing it would therefore require an application-owned keyboard reorder path and announcements in addition to pointer dragging.

## Comparison

| Candidate | Actual dragging | Handle | Keyboard and assistive technology | Vue 3 / Nuxt SSR | Nested CV suitability | Complexity | Maintenance signal at research date | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [`@formkit/auto-animate`](https://auto-animate.formkit.com/) | **No.** It animates immediate children when DOM nodes are added, removed, or moved. Another interaction or state change must perform the reorder. | Not applicable. | No reorder interaction to operate by keyboard. It does automatically disable animation for `prefers-reduced-motion`. | First-party Vue directive/composable and an official Nuxt module are documented. | Useful only to animate an already-completed reorder. Immediate-child and flex sizing constraints deserve care in the workbench. | Low for animation, but it does not solve drag-and-drop. | npm reports [`0.10.0`, published recently](https://www.npmjs.com/package/@formkit/auto-animate); official GitHub project remains active. | Complement only, and not on dnd-kit-owned sortable rows initially. |
| [`@formkit/drag-and-drop`](https://drag-and-drop.formkit.com/) | **Yes.** It reorders reactive data rather than treating the DOM as the source of truth. | Yes, through `dragHandle`. | No documented built-in keyboard sensor. The official accessibility example adds its own key handlers, selection state, focus management, direct array moves, instructions, and live region. | First-class Vue `useDragAndDrop` wrapper. No explicit official Nuxt/SSR guarantee was found, so verify hydration locally. | Good for multiple lists and grouped parents. Each parent must have the same number of values and immediate draggable children, which adds care around nested Employment Occasion and CV Block components. No first-party tree/nested recipe was found. | Low for a flat list; medium for nested groups plus a complete keyboard path. | npm reports [`0.6.1`, published recently](https://www.npmjs.com/package/@formkit/drag-and-drop); the official repository has ongoing work and framework test projects. | Strong data-first option, but accessibility remains application work. |
| [`vue-draggable-plus`](https://vue-draggable-plus.pages.dev/en/) + [SortableJS](https://github.com/SortableJS/Sortable) | **Yes.** `v-model` is updated from SortableJS drag events. | Yes, via the `handle` selector. | No built-in keyboard sensor, ARIA instruction, or live-announcement API is documented by either project. Equivalent controls must be built separately. | Supports Vue 3 and Vue 2.7. Its source initializes SortableJS in Vue's `onMounted`, which makes SSR integration plausible, but neither official project documents Nuxt SSR support; verify build and hydration. | Very good pointer support. Official docs show recursive nested components; SortableJS supports shared lists, nested sortables, auto-scroll, and drop constraints. | Lowest for pointer/touch; medium once accessible controls and announcements are added. | npm reports [`vue-draggable-plus` 0.6.1](https://www.npmjs.com/package/vue-draggable-plus) and [`sortablejs` 1.15.7](https://www.npmjs.com/package/sortablejs), both published within the past six months. | Best fallback if dnd-kit fails the Nuxt spike. |
| [`@dnd-kit/vue`](https://dndkit.com/vue/quickstart/) | **Yes.** `useSortable` combines draggable, droppable, and sorting behavior; state is committed at `dragEnd`. | Yes, through a dedicated `handle` template ref. | Best candidate. `DragDropProvider` defaults to pointer and keyboard sensors. Its default Accessibility plugin manages ARIA attributes, screen-reader instructions, and live-region announcements, all of which are customizable. | First-party thin Vue adapter requiring Vue 3.5+. No explicit Nuxt/SSR guarantee was found; provider/composable placement also requires a child component because it uses `provide`/`inject`. | Strong for flat lists, multiple containers, grouped records, and nested contexts. App code still owns legal parent/group moves and arbitrary tree reparenting. | Medium: provider, one sortable row component, handle ref, domain drop rules, and a `dragEnd` state commit. | npm reports [`0.5.0`, published recently](https://www.npmjs.com/package/@dnd-kit/vue); the main project is active. The Vue adapter is nevertheless young and still `0.x`. | Recommended behind an integration spike. |

## Candidate details

### FormKit AutoAnimate

AutoAnimate is frequently shown beside sortable lists because it makes programmatic sorting look smooth. The official docs are precise about its boundary: it watches a parent and animates its immediate children when they are added, removed, or moved. It supplies neither drag sensors nor drop/reorder state ([usage and constraints](https://auto-animate.formkit.com/)).

It has the strongest explicit Nuxt story in this comparison: the official Vue documentation offers a global directive, composable, and Nuxt module. It also respects `prefers-reduced-motion`. Those strengths make it useful for secondary workbench motion, but not a substitute for an interaction library.

### FormKit Drag and Drop

FormKit's separate [`@formkit/drag-and-drop`](https://github.com/formkit/drag-and-drop) package is a real drag-and-drop library. Its Vue wrapper returns a parent ref and reactive values, and dragging changes the values. It supports handles, same-list sorting, list-to-list transfer, drop acceptance rules, and an experimental animation plugin ([official feature documentation](https://drag-and-drop.formkit.com/)).

The accessibility distinction matters. FormKit publishes a useful accessibility example, but the example implements keyboard navigation, pick-up/drop semantics, focus state, live announcements, and direct reactive-array movement in application code. That is evidence the library can be incorporated into an accessible result, not evidence of built-in keyboard drag behavior.

For this builder, one FormKit parent could own Employment Occasion groups and another parent inside each group could own Experience Blocks. The official immediate-child/value-count rule means headings, empty messages, and controls must sit outside each draggable parent or be filtered deliberately. That is manageable but easier to misconfigure than dnd-kit's per-item composables.

### vue-draggable-plus and SortableJS

vue-draggable-plus wraps SortableJS with Vue components, a directive, and a composable, with two-way list binding and TypeScript support ([official overview](https://vue-draggable-plus.pages.dev/en/)). It exposes the SortableJS `handle` selector and has an [official recursive nesting example](https://vue-draggable-plus.pages.dev/en/demo/nested/). SortableJS itself documents shared lists, handles, nested sortables, auto-scroll, and touch support ([official project](https://github.com/SortableJS/Sortable)).

This is a mature pointer/touch solution. However, the documented APIs enumerate pointer drag lifecycle and sorting options without a keyboard sensor or accessibility announcement layer ([vue-draggable-plus API](https://vue-draggable-plus.pages.dev/en/api/); [SortableJS options](https://github.com/SortableJS/Sortable#options)). If selected, the ticket must retain explicit Move up/down/top/bottom actions or implement a keyboard pick-up/move/drop pattern and an `aria-live` announcer.

The wrapper's official source creates its SortableJS instance from `onMounted`, rather than during Vue's server render ([`useDraggable` source](https://raw.githubusercontent.com/Alfred-Skyblue/vue-draggable-plus/main/src/useDraggable.ts)). This is encouraging, but it is not an official Nuxt compatibility claim.

### dnd-kit Vue

The first-party Vue adapter is built over dnd-kit's framework-agnostic DOM layer. [`useSortable`](https://dndkit.com/vue/composables/use-sortable/) exposes an item ID, current index, group, handle ref, accepted types, transition, modifiers, sensors, and collision detection. The `move` helper supports flat arrays and grouped records; conditional `dragOver` handling can prevent illegal optimistic moves.

[`DragDropProvider`](https://dndkit.com/vue/components/drag-drop-provider/) defaults to pointer and keyboard sensors. The default [`Accessibility` plugin](https://dndkit.com/extend/plugins/accessibility/) adds ARIA state, instructions, and live announcements and permits product-specific wording. The main repository explicitly lists multiple containers and nested contexts among supported cases ([official repository](https://github.com/clauderic/dnd-kit)).

The tradeoff is maturity and setup. The Vue adapter is at version `0.5.0`, and its official docs do not name Nuxt or SSR. The adapter also requires sortable composables to live in descendants of `DragDropProvider`, so the implementation should introduce a small `CompositionSortableItem` component rather than trying to keep every composable in the page component.

## Required integration spike

Before making dnd-kit the production dependency, build a disposable vertical slice with one Experience section, two Employment Occasion groups, and at least three Experience Blocks per group.

The spike passes only if all of the following are demonstrated:

- `nr build` completes under the repository's Nuxt 4 SSR build.
- The server-rendered route hydrates without browser or server warnings.
- A visible drag handle is the only pointer drag activator; text selection and row menu actions remain usable.
- Mouse, touch, and keyboard can reorder Employment Occasion groups and reorder Blocks within a group.
- Screen-reader instructions and move/cancel/drop announcements use employer, role, and Block labels rather than opaque IDs.
- Illegal moves are rejected before state persistence, including any boundary required by Employment Occasion grouping and one-Version-per-Block identity.
- Exactly one Working Composition update/autosave is emitted at the end of a successful drag, and none for a canceled or unchanged drag.
- The moved item retains focus after keyboard drop and after autosave settles.
- Reduced-motion mode removes or materially shortens sortable transitions.
- Collapsed sections, the slide-out preview, and scrollable workbench regions do not break collision detection or auto-scroll.

If this spike fails on SSR/hydration or produces unstable nested collisions, use vue-draggable-plus for pointer/touch behavior and keep the same domain-level reorder command, accessible menu actions, and announcements.

## Experience: sort by job date

Treat job-date sorting as an explicit bulk reorder of **Employment Occasion groups**, not a persistent view filter and not a sort of individual Experience Blocks.

Recommended control:

- Put **Sort Experience** in the Experience section header.
- Offer **Job date — newest first** and **Job date — oldest first**.
- Keep the selected Blocks inside each Employment Occasion in their current manual order.
- Leave Experience Blocks deliberately placed in another presentation section where they are; sorting does not silently move content across sections.
- Apply the result to the Working Composition as one autosaved change and offer **Undo**.

Recommended deterministic comparison:

- Newest first: ongoing Employment Occasions (no `endDate`) first, then later `endDate`, then later `startDate`.
- Oldest first: earlier `startDate`, then earlier `endDate`, with ongoing roles after completed roles.
- Dates already use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Compare their numeric year/month/day parts; missing month/day parts sort as zero. Preserve the existing group order when the available date precision ties, so repeated sorting is stable.

Manual drag and bulk sort should coexist as order-setting commands:

1. Applying a job-date sort writes that order and labels the section order **Newest first** or **Oldest first**.
2. A subsequent successful manual drag changes the label to **Custom** and autosaves the new order.
3. Reapplying a date sort replaces the custom group order only after the user selects the command; it never continuously re-sorts after every Employment Occasion edit.
4. Manual reordering inside an Employment Occasion does not change the group-level date-sort label because it does not alter job order.

This model keeps the underlying Working Composition authoritative, makes the bulk action reversible, and avoids a hidden sorting mode fighting the user's later drag decisions.

## Ticket implications

1. **Spike dnd-kit Vue in Nuxt 4** using the pass criteria above.
2. **Introduce domain-level reorder commands** for group reorder, Block reorder, and permitted cross-list movement; keep library event objects out of persistence code.
3. **Build accessible sortable rows** with dedicated handles, keyboard sensor behavior, product-specific announcements, focus restoration, and reduced motion.
4. **Add Experience job-date bulk sorting** with stable partial-date comparison, Custom state, one autosave, and Undo.
5. **Verify the complete workbench** with pointer, touch, keyboard, screen-reader announcements, collapsed sections, preview drawer, autosave conflict handling, and Nuxt SSR/hydration checks.
