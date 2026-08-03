# JSON Resume theme licence and adaptation audit

Date: 2026-07-29

## Decision

Resume Studio can safely adapt the visual treatment of **Even**, **Actual**, and
the scoped **Class** theme. Each upstream repository has both an explicit MIT
licence file and MIT package metadata. They are the strongest immediate set
because they are visually distinct, map onto the existing `CvDocument` markup,
and do not require importing an upstream runtime renderer.

Five additional themes from the current JSON Resume monorepo are also viable
MIT-licensed design sources: **Data-Driven**, **Developer Mono**, **Government
Standard**, **Two-Column Modernist**, and **New York Editorial**.

No Apache-2.0 candidate was promoted. The primary-source searches did not find
an Apache-2.0 JSON Resume theme whose current package metadata, source
repository, and licence could all be verified. This is not a claim that none
exists; it means only that the approved shortlist below is MIT-only.

## Scope and source standard

JSON Resume's official gallery says its themes are open-source,
community-built packages, and its development guide defines a theme as a
renderer that accepts JSON Resume data and returns HTML:

- [Official theme gallery](https://www.jsonresume.org/themes)
- [Official theme development guide](https://www.jsonresume.org/theme-development)
- [Official monorepo theme directory at the audited revision](https://github.com/jsonresume/jsonresume.org/tree/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes)
- [Official monorepo MIT licence at the audited revision](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/LICENSE)

Only primary sources were used for approval: upstream GitHub source and licence
files, upstream package manifests, JSON Resume's own documentation, and npm's
official registry metadata.

This is an engineering licence audit, not legal advice.

## Immediate shortlist

### 1. Even

- **Repository:** [rbardini/jsonresume-theme-even](https://github.com/rbardini/jsonresume-theme-even/tree/8231a31977aa7bfc7c1724713b523a85f32a760d)
- **Licence:** MIT. See the [pinned licence](https://github.com/rbardini/jsonresume-theme-even/blob/8231a31977aa7bfc7c1724713b523a85f32a760d/LICENSE) and [`package.json`](https://github.com/rbardini/jsonresume-theme-even/blob/8231a31977aa7bfc7c1724713b523a85f32a760d/package.json).
- **Upstream design:** Flat, airy CSS-grid layout with configurable neutral and
  accent colours, light/dark palettes, Markdown support, and a subtle visual
  timeline. See the [pinned README](https://github.com/rbardini/jsonresume-theme-even/blob/8231a31977aa7bfc7c1724713b523a85f32a760d/README.md).
- **Resume Studio adaptation:** Use the centred neutral header, quiet blue
  accent, two-column content grid, experience timeline, and compact side-list
  chips. Keep Resume Studio's existing Vue rendering and JSON Resume adapter;
  do not add Even's Markdown renderer, icon dependency, CLI, or theme runtime.
- **Safety/compatibility:** Continue rendering user content as Vue text. Keep
  the existing A4 print rules and collapse the two-column layout on narrow
  screens. Use system fonts rather than copying or fetching font assets.
- **Notice required:** Preserve `Copyright (c) 2018 Rafael Bardini` and the full
  MIT notice in `THIRD_PARTY_NOTICES.md` if the adaptation copies a substantial
  portion of the upstream styling.

### 2. Actual

- **Repository:** [davcd/jsonresume-theme-actual](https://github.com/davcd/jsonresume-theme-actual/tree/4176e5ce2e16a964ed4ab515d554bb16706e0858)
- **Licence:** MIT. See the [pinned licence](https://github.com/davcd/jsonresume-theme-actual/blob/4176e5ce2e16a964ed4ab515d554bb16706e0858/LICENSE) and [`package.json`](https://github.com/davcd/jsonresume-theme-actual/blob/4176e5ce2e16a964ed4ab515d554bb16706e0858/package.json).
- **Upstream design:** Minimalist, monochrome, single-font treatment with a
  large name, restrained rules, and a content-first layout. The README states
  support for JSON Resume 1.0 sections and optional Markdown fields. See the
  [pinned README](https://github.com/davcd/jsonresume-theme-actual/blob/4176e5ce2e16a964ed4ab515d554bb16706e0858/README.md).
- **Resume Studio adaptation:** Use bold display typography, a thin divider,
  a roughly 70/30 main/aside split, minimal bullets, and a right-aligned
  secondary column. Do not import Pug, Sass, Moment, Markdown-It, or its
  generated templates; the design can be expressed in scoped CSS against the
  existing semantic markup.
- **Safety/compatibility:** Keep long achievements readable by returning to one
  column on narrow screens and avoid multi-column bullets in print when they
  would split content unpredictably.
- **Notice required:** The upstream licence names
  `Copyright (c) 2020 EGOIST (https://egoist.sh)`. Preserve that exact notice
  and the full MIT text.

### 3. Class (scoped package)

- **Repository:** [jsonresume/jsonresume-theme-class](https://github.com/jsonresume/jsonresume-theme-class/tree/7c8ed4b40a28164626e419a52dea0d800e37a4a0)
- **Package:** `@jsonresume/jsonresume-theme-class`; use the scoped package as
  the identity to avoid confusion with older similarly named packages.
- **Licence:** MIT. See the [pinned licence](https://github.com/jsonresume/jsonresume-theme-class/blob/7c8ed4b40a28164626e419a52dea0d800e37a4a0/LICENSE) and [`package.json`](https://github.com/jsonresume/jsonresume-theme-class/blob/7c8ed4b40a28164626e419a52dea0d800e37a4a0/package.json).
- **Upstream design:** Self-contained, ATS-oriented single-column design with
  a blue name bar, compact section separators, localisation, dark-mode support,
  and no required third-party network requests. See the
  [pinned README](https://github.com/jsonresume/jsonresume-theme-class/blob/7c8ed4b40a28164626e419a52dea0d800e37a4a0/README.md).
- **Resume Studio adaptation:** Use the blue header, single-column experience
  flow, understated section rules, and a compact two-column grid for short
  supporting sections. Reuse Resume Studio's renderer and system font stack;
  do not import Handlebars, Fluent, Marked, or the upstream HTML renderer.
- **Security note:** The upstream README explicitly warns that its renderer
  does not sanitize input/output. Resume Studio should not adopt that path.
  Vue text interpolation preserves the current safe boundary.
- **Notice required:** Preserve both copyright lines from the pinned licence:
  `Copyright (c) 2014-2014 James Spencer` and
  `Copyright (c) 2022-2025 JSON Resume and Contributors`, plus the full MIT
  text.

## Viable next-wave designs

All themes in this section live in the official JSON Resume monorepo at audited
revision `8d9134b92bd885f0ffdbb9eabaf42540bf659c1d` and are covered by its root
MIT licence. A substantial adaptation should include the root notice:
`Copyright (c) 2014-2026 JSON Resume contributors`.

| Theme | Primary source | Distinct value | Adaptation notes |
| --- | --- | --- | --- |
| Data-Driven | [README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-data-driven/README.md), [source](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-data-driven/src/ui/Resume.jsx) | Compact geometric sans-serif layout with sky-blue accents and strong emphasis on measurable outcomes. | Adapt hierarchy, spacing, and accent treatment. Do not parse or inject HTML merely to auto-bold numbers; keep metrics as ordinary text unless the domain model later exposes them structurally. |
| Developer Mono | [README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-developer-mono/README.md), [source](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-developer-mono/src/Resume.jsx) | Technical single-column design with monospace headings, sans-serif body, and a restrained blue accent. | Use a system monospace stack for headings and keep the body sans-serif. Avoid code-editor decoration that could reduce ATS readability. |
| Government Standard | [README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-government-standard/README.md), [source](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-government-standard/src/Resume.jsx) | Formal grayscale, serif, single-column layout designed for compliance, ATS parsing, and print. | Strong low-risk addition: system serif fonts, black rules, no colour dependency, and conservative page breaks. |
| Two-Column Modernist | [README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-two-column-modernist/README.md), [source](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-two-column-modernist/src/Resume.jsx) | Asymmetric Swiss/European two-column grid with neutral grotesk typography. | This maps directly to `CvDocument`'s main/aside structure. Explicitly test narrow screens, long URLs, and A4 overflow. |
| New York Editorial | [README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-new-york-editorial/README.md), [source](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-new-york-editorial/src/Resume.jsx) | Dense editorial typography with serif headings and magazine-like polish. | Viable but lower priority because Resume Studio already has an Editorial theme. Use a neutral internal/product name and do not imply affiliation with publications named as design inspiration upstream. |

## Rejected or deferred candidates

### `jsonresume-theme-modern`

Reject for this request. npm's
[official registry metadata](https://registry.npmjs.org/jsonresume-theme-modern/latest)
declares `license: "ISC"`, which is permissive but outside the user's explicit
MIT/Apache-2.0 allowlist.

### `jsonresume-theme-boilerplate`

Reject as a product theme. Its
[official registry metadata](https://registry.npmjs.org/jsonresume-theme-boilerplate/latest)
declares MIT but also marks the package deprecated and unmaintained and points
users to the current monorepo themes. It is scaffolding, not a differentiated
CV design.

### `jsonresume-theme-professional`

Defer direct code adaptation pending a provenance pass. The
[theme README](https://github.com/jsonresume/jsonresume.org/blob/8d9134b92bd885f0ffdbb9eabaf42540bf659c1d/packages/themes/jsonresume-theme-professional/README.md)
explicitly credits two external CV projects. The monorepo is MIT, but copying
distinctive implementation details should wait until those credited sources
and their licences are audited. The approved alternatives above avoid this
extra uncertainty.

### Packages without matching primary evidence

Reject any package where npm metadata, repository ownership, and a licence file
do not agree, or where the source repository is missing. A package name or
gallery preview alone is not enough evidence to copy code or a substantial
design.

## Implementation guardrails

1. Treat these as visual adaptations, not runtime dependencies. Resume Studio's
   current Vue renderer and domain model should remain the source of markup and
   content semantics.
2. Namespace every adaptation under its theme class so preview, published
   pages, and print output use the same renderer without style leakage.
3. Keep all user-provided content in Vue text interpolation. Do not adopt
   upstream Markdown-to-HTML paths without a separate sanitization design and
   test suite.
4. Do not copy font binaries, icon sets, screenshots, logos, or other bundled
   assets unless their own licences are audited. Prefer system font stacks and
   CSS shapes.
5. Preserve visible contact links, A4 print rules, `break-inside` protection,
   and a single-column mobile fallback.
6. Record the exact upstream revision and full required licence text in
   `THIRD_PARTY_NOTICES.md`; a comment that says only “MIT-licensed” is not a
   substitute for MIT's notice-retention condition.
7. Test theme registration/fallback, editor selection, preview/public parity,
   mobile layout, long content, empty optional sections, and print CSS for every
   added theme.
