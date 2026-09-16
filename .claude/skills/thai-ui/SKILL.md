---
name: thai-ui
description: Thai-language UI rules for PIPOL TUTOR — fonts (Mitr/Anuphan), line height for stacked tone marks and vowels, the product colour palette, THB price and Thai date formatting, and phone-first responsive behaviour. Use when writing or reviewing any user-facing markup, copy, or styling for this project.
---

# Thai UI rules

The whole product is in Thai, read on a phone in the evening by an 11–12 year old student and a parent looking together. `preview/09-exam.html` and `figma-plugin/code.js` are the reference implementations — match them rather than inventing new values.

## Fonts

| Role | Family | Where |
| --- | --- | --- |
| Display — headings, prices, numbers that carry weight | **Mitr** 400/500/600 | `DISPLAY` in `figma-plugin/code.js` |
| Body, UI, everything else | **Anuphan** 400/500/600 | `BODY` in `figma-plugin/code.js` |
| Icons | Material Symbols Rounded | filled variant via the `FILL` axis |

Body stack: `"Anuphan", system-ui, -apple-system, "Segoe UI", sans-serif`. Both families cover Thai and Latin, so do not mix in a Latin-only font (Geist, Inter, Arial) for a surface that shows Thai — the fallback rendering breaks the vertical rhythm. `frontend/pipoltutor-app/app/layout.tsx` and `globals.css` still carry the create-next-app Geist defaults and `lang="en"`; replace them with Mitr/Anuphan and `lang="th"` on any page that ships.

## Line height — the thing that actually matters

Thai stacks up to two marks above the baseline (upper vowel plus tone mark) and one below. Latin-tuned leading clips them or makes lines collide.

- Body text: **1.7–1.8** (the Figma plugin uses 178%). Never below 1.6 for a Thai paragraph.
- Display and headings: **1.3–1.35** (plugin uses 134%). Never below 1.25 — even a heading has marks to clear.
- `line-height: 1` is only ever for an icon glyph in its own box.
- Do not set a fixed pixel line height on Thai text, and never clamp a Thai line with `height` + `overflow: hidden` — use `-webkit-line-clamp` with the leading above.
- Minimum body size on phone is 16px; small print stays at 14px and keeps 1.7 leading.
- `letter-spacing` on Thai must stay at 0. Tracking separates a mark from its base character.

Never wrap Thai text mid-word for effect. Thai has no spaces between words, so a browser breaks at cluster boundaries — do not add manual `<br>` inside a sentence to force a shape; it will land in the wrong place at another width.

## Palette

Tokens are shared between `preview/09-exam.html` and `figma-plugin/code.js` — copy, do not re-pick.

```css
--page:#F5F7FC; --card:#FFFFFF;
--brand:#3A5BD9; --brand-dark:#1E2F86; --brand-50:#EEF2FF;
--accent:#FF6B35; --accent-dark:#E5551C; --accent-50:#FFEDE4;
--mystic:#7C3AED; --mystic-50:#F0E9FF;     /* fortune-telling module only */
--teal:#12B5A5; --green:#16A34A; --green-50:#E4F6EA;
--red:#EF4444; --amber-50:#FEF3DC; --amber-ink:#7C4A03; --amber-icon:#B45309;
--ink:#111C3E; --ink2:#46557A; --ink3:#8493B4;
--border:#E3E9F4; --border-strong:#CBD6EA;
--sh-s:0 2px 6px rgba(17,28,62,.06);
--sh-m:0 14px 30px -8px rgba(17,28,62,.10);
```

Green means answered/saved, red means flagged or error, amber means warning, purple is reserved for the fortune-telling module. Define the light palette on bare `:root`, then redefine only what changes under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]` so an explicit toggle wins — the same three-block pattern the preview uses.

## Numbers, money, dates

- Prices are Arabic numerals with a comma and a trailing `บาท` or `฿`: `4,900 บาท`, `590 บาท`, `5,200 บาท`. No decimals — nothing is priced in satang at the display layer even though the DB stores satang.
- Convert with `satang / 100` and format via `Intl.NumberFormat("th-TH")`. Never format money by string concatenation.
- Dates use the Buddhist era, which is the Gregorian year + 543: `25 มกราคม 2569`. Use `Intl.DateTimeFormat("th-TH", { calendar: "buddhist" })` rather than adding 543 by hand.
- Thai digits (๑๒๓) are not used anywhere in this product.
- Countdown and timer labels read `เหลือเวลา` + `ชั่วโมง`/`นาที`/`วินาที`; keep the unit words, do not compress to `h/m/s`.

## Responsive and interaction

- Phone and desktop are both first-class; design phone-first and let the layout widen.
- Tap targets are at least 44×44px — the exam navigator cells and flag button are used at speed by a child on a phone.
- Every interactive element keeps a visible `:focus-visible` ring; the preview gives one ring style to options, tabs, flag button, buttons, and navigator cells together.
- Honour `@media (prefers-reduced-motion: reduce)`.
- Wide content (the 100-cell navigator, any table) scrolls inside its own `overflow-x: auto` container. The page body never scrolls horizontally.

## Copy

Thai, informal-polite, addressing the student directly; the tutor is `พี่พิพล`. Parent-facing surfaces (checkout, consent, price justification) shift to plain, reassuring wording — the parent is the payer.

Everything in the ASSUMPTIONS section of `PRODUCT.md` is invented placeholder copy: instructor name and biography, all proof numbers, testimonials, the 25 มกราคม 2569 exam date and its countdown, and the fortune-telling prices and rules. Do not present placeholders as confirmed, and do not build logic that silently depends on a placeholder number being real.
