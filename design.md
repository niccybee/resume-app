# Resume Studio design system

The product should feel like a well-edited working document: warm paper, dark ink and one decisive coral marker. It is editorial rather than corporate, tactile rather than glossy, and structured enough to support serious composition work.

## Principles

1. **The CV is the visual metaphor.** Paper, rules, annotations and document stacks should communicate what the product does before copy has to explain it.
2. **Use contrast with intent.** Dark ink carries structure. Coral marks the current action or the most important phrase. Everything else stays quiet.
3. **Prefer evidence to decoration.** Layouts should reveal blocks, versions, selections and publication state. Ornament should support that mental model.
4. **Keep the edges honest.** Square corners, firm rules and offset shadows make the interface feel authored and direct.

## Colour

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f3ecdf` | Page background |
| `--paper-light` | `#fffaf0` | Cards, documents and inputs |
| `--paper-deep` | `#dfd2bd` | Dividers and stacked sheets |
| `--ink` | `#191713` | Text, rules and primary actions |
| `--muted` | `#645d52` | Secondary text |
| `--marker` | `#f05a3d` | Primary accent and active marks |
| `--marker-soft` | `#f7c6b8` | Selections and soft emphasis |
| `--success` | `#2f6b4f` | Confirmed or completed states |

Coral is a marker, not a wash. Avoid using it for large background regions except for deliberately stacked paper or a single emphatic moment.

## Typography

- **Editorial:** Georgia for large headlines, CV names and section statements.
- **Interface:** Avenir Next, falling back to the system sans-serif stack, for controls and body copy.
- **Labels:** SF Mono, falling back to Consolas or Liberation Mono, for statuses, counters, metadata and eyebrow labels.

Large headings should be tightly set and can break across lines like a magazine headline. Body copy should stay open and readable. Uppercase monospace belongs only to compact labels.

## Components

- Primary buttons use ink fill, square corners and a coral offset shadow.
- Text actions use an understated coral underline.
- Cards resemble sheets: paper-light fill, dark rules and little or no conventional shadow.
- Active blocks may use marker-soft as a highlight behind the selected row.
- Statuses use outlined monospace labels; colour communicates state but text always names it.

## Layout and motion

Use asymmetry at presentation level and strict alignment inside tools. Public pages can pair oversized editorial copy with stacked-document imagery. Workspace screens should favour stable columns, strong horizontal rules and clear section placement.

Motion should be brief and physical: a button shadow compresses when pressed, a selected sheet rises slightly, and state changes fade quickly. Respect reduced-motion preferences and never animate the CV while printing.

## Accessibility

Keep ink on paper as the default contrast pair, never rely on colour alone for state, preserve visible focus styles, and use semantic headings and ordered steps. All public and workspace layouts must collapse cleanly to one column below tablet width.
