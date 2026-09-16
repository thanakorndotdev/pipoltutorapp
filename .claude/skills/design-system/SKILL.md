---
name: design-system
description: The PIPOL TUTOR visual system — where the design truth lives (figma-plugin/code.js, preview/*.html), the token set, breakpoints, component patterns, and the 13 screens in scope. Use when building or reviewing a screen, adding a component, changing tokens, syncing Figma with code, or before running a broader design pass.
---

# PIPOL TUTOR design system

## Where the truth lives

There is no `DESIGN.md` yet. The visual system is defined in two places, and they are meant to agree:

| Source | Role |
| --- | --- |
| `figma-plugin/code.js` | Draws all 13 screens into Figma at three widths. Holds the canonical token objects: `C` (colour), `DISPLAY`/`BODY`/`ICONS` (type), `BREAKPOINTS`. |
| `preview/*.html` | Static HTML mockups of individual screens. `09-exam.html` is the most complete and carries the same tokens as CSS custom properties. |

`PRODUCT.md` is the product truth: audience, mechanism, prices, constraints, and an explicit ASSUMPTIONS list of invented placeholder content.

When a token changes, change it in `figma-plugin/code.js` **and** the preview CSS, and say so — a value that exists in only one of them is a drift bug, not a variant. Before adding a token, check whether one of the existing ones already covers the case.

## Tokens

```css
--page:#F5F7FC; --card:#FFFFFF;
--brand:#3A5BD9; --brand-dark:#1E2F86; --brand-50:#EEF2FF;
--accent:#FF6B35; --accent-dark:#E5551C; --accent-50:#FFEDE4;
--mystic:#7C3AED; --mystic-50:#F0E9FF;
--teal:#12B5A5; --green:#16A34A; --green-50:#E4F6EA;
--red:#EF4444; --amber-50:#FEF3DC; --amber-ink:#7C4A03; --amber-icon:#B45309;
--ink:#111C3E; --ink2:#46557A; --ink3:#8493B4;
--border:#E3E9F4; --border-strong:#CBD6EA;
--sh-s:0 2px 6px rgba(17,28,62,.06);
--sh-m:0 14px 30px -8px rgba(17,28,62,.10);
```

Night mode (`60% #111827 / 30% #C5D4FF / 10% #FFE3A3`) is a translation of the same tokens, not a
second palette to design against:

```css
--page:#111827; --card:#1A2233;
--brand:#C5D4FF; --brand-dark:#C5D4FF; --brand-50:#1B2540;
--accent:#FFE3A3; --accent-dark:#F0CE86; --accent-50:#2B2618;
--mystic:#CBB4FF; --mystic-50:#241C3A;
--teal:#86DCD0; --green:#7ED598; --green-50:#16301F;
--red:#FF9494; --amber-50:#2E2718; --amber-ink:#FFE3A3; --amber-icon:#FFD37A;
--ink:#EEF2FF; --ink2:#B9C4E0; --ink3:#8C99B8;
--border:#2A3547; --border-strong:#3A4761;
--on-fill:#111827;   /* text on a brand/accent/status fill; #FFFFFF in light */
```

The ground is blue-toned already, so the periwinkle reads across whole surfaces rather than only in
accents. One colour translates two ways depending on the job — `#FFFFFF` is a card underneath and a
label on top — so the plugin keeps `DARK_SURFACE` and `DARK_TEXT` separately and `fill()` picks by
node type; `--on-fill` is the CSS equivalent. Adding a token means adding both its night entries.
The plugin draws night mode from the `🌙 ธีมกลางคืน` submenu, onto the same page below the light
row, with frames named `PT ☾ …`.

Semantics: brand blue is the primary action and identity. Accent orange is the single loudest call to action per screen — spending it twice on one screen kills it. Purple is reserved for the fortune-telling module and appears nowhere else. Green means answered or saved, red means flagged or error, amber means warning. Ink levels step primary → secondary → tertiary text; never introduce a fourth grey.

Type is Mitr for display and Anuphan for body, with the Thai line-height floors described in the `thai-ui` skill. Load `thai-ui` before writing any user-facing markup — leading and letter-spacing are where Thai UI actually breaks.

## Breakpoints

From `figma-plugin/code.js`:

| Name | Width | Page gutter | Behaviour |
| --- | --- | --- | --- |
| Desktop | 1440 | 72 | Full two-column page splits |
| Tablet | 834 | 40 | Page-level splits stack; card grids go two across |
| Mobile | 430 | 20 | Everything is one column |

Phone and desktop are both first-class (`PRODUCT.md`). Design at 430 first — the real scene is a phone in the evening, often with a parent looking over a shoulder.

## Shape and depth

Radii are large and consistent: `999px`/`99px` for pills, chips, and the flag button; `18–28px` for cards, panels, and modals; small radii (`5–14px`) only for dense inline elements like input affordances. Two shadow levels only — `--sh-s` for a resting card, `--sh-m` for something lifted above the page. No third shadow, no borders-plus-heavy-shadow on the same element.

## Component patterns

Named in `preview/09-exam.html`; reuse these rather than inventing parallel ones:

- `.card` — the base surface: `--card` on `--page`, `--border` hairline, `--sh-s`.
- `.btn` with `.primary` / `.brand` / `.ghost` — one primary per view.
- `.pill` — status chip; `.saved` is the green autosave indicator.
- `.opt` — an exam answer choice, full-width tap target.
- `.cellbtn` — a question navigator cell, with `.done` (green), `.flagged` (red), `.here` (current). Untouched is the bare state.
- `.flagbtn` — `aria-pressed` toggle, red when on.
- `.eyebrow`, `.footnote`, `.legend` — supporting type roles.

Every interactive element shares one `:focus-visible` ring — options, tabs, flag button, buttons, and navigator cells are styled together on purpose. Keep them together. Honour `@media (prefers-reduced-motion: reduce)`.

Theming uses the three-block pattern: light palette on bare `:root`, dark overrides under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, then the same overrides under `:root[data-theme="dark"]` so an explicit toggle wins both ways.

## The 13 screens

Landing, About, Login (Google OAuth), Dashboard, Catalog, Course detail, Checkout, Payment success (auto-unlock + LINE invite), Exam, Score report, Fortune form, Fortune payment, Fortune result.

The Figma plugin draws each of these at all three widths onto one page (`🎯 PIPOL TUTOR`, nodes prefixed `PT · `). Redrawing a single screen is the fast iteration path — see `figma-plugin/README.md`. It runs in the Figma desktop app and uses no MCP quota. Mitr and Anuphan must be installed or the run stops.

## Rules

- Match the incumbent system before extending it. A new colour, radius, shadow, or type role needs a reason, and it lands in both token sources.
- Everything in the `PRODUCT.md` ASSUMPTIONS list is placeholder: the instructor name and biography, all proof numbers, testimonials, the 25 มกราคม 2569 exam date and its countdown, and every fortune-telling price and rule. Do not present placeholders as confirmed or build logic that depends on one being real.
- The exam screen has hard behavioural constraints that outrank visual preference — see the `exam-engine-rules` skill.
- For a broader design pass (redesign, audit, critique, polish), the globally installed `impeccable` skill drives the process; this skill supplies the incumbent visual truth it should preserve.
