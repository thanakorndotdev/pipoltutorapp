# PIPOL TUTOR Builder — Figma plugin

Draws the 13 PIPOL TUTOR screens at three widths straight into your Figma file. It runs inside the Figma
desktop app, so it does not touch the Figma MCP server and does not use any MCP quota.

## Requirements

- **Figma desktop app** (the browser version cannot import a local plugin)
- Fonts installed and visible to Figma: **Mitr**, **Anuphan**, and **Material Symbols Rounded**
  (all three were already available in your Figma when we checked). Missing Material Symbols
  only degrades icons to dots; missing Mitr or Anuphan stops the run with a message.

## How to run

1. Open the Figma desktop app and open the PIPOL TUTOR file.
2. Menu **Plugins → Development → Import plugin from manifest…**
3. Pick `figma-plugin/manifest.json` from this folder.
4. Menu **Plugins → Development → PIPOL TUTOR Builder**, then pick a command.

## Menu commands

One plugin, sixteen entries:

| Command | What it does |
|---|---|
| **— ทั้งหมด 13 เพจ —** | Clears every `PT · ` node in the file and redraws all 13 screens onto their own pages |
| **01 หน้าแรก** … **13 ดูดวง — คำทำนาย** | Redraws just that one screen, on its own page |
| **จัดเรียงเพจใหม่** | Reorders the pages and re-aligns the frames already on them, without redrawing |
| **🌙 ธีมกลางคืน › …** | The same commands drawn in night mode — `dark-all` for all 13, `dark-s01`…`dark-s13` for one |

Redrawing one screen is the fast path while you iterate: it clears and redraws only that
screen's page and leaves the other twelve alone.

The menu is generated from the `SCREENS` array in `code.js`. Add a screen there and you must
add a matching `menu` entry in `manifest.json` with the same `name`; `smoke-test.js` fails if
the two drift apart.

## Night mode

The `🌙 ธีมกลางคืน` submenu redraws the same screens on the night palette: 60% `#101010` ground,
30% `#B1E6F3` pastel blue, 10% `#FFD4A1` pastel orange. Screens are still written once, against the
light `C` tokens — `themed()` translates each token at paint time through `DARK_SURFACE` (fills,
strokes, gradients) or `DARK_TEXT` (glyphs), and a `fixContrast()` sweep over the finished frame
flips any label that landed unreadable on its own background (white on a pastel button, say).

The night row lands on the **same page**, below the light row, because a Figma Starter plan caps a
file at three pages. Dark frames are named `PT ☾ …` instead of `PT · …`, so a run of one theme
clears and redraws only its own frames and leaves the other theme's row alone.

Each screen gets its own Figma page, named after the screen (`01 หน้าแรก`, `02 รู้จักพี่ที`, …).
On every page the three widths sit side by side, left to right, with a label over each column.

| Column | Frame width | Gutter |
|---|---|---|
| Desktop | 1440 | 72 |
| Tablet | 834 | 40 |
| Mobile | 430 | 20 |

13 pages x 3 widths = 39 frames. Frames are named `PT · 09 ทำข้อสอบ · Mobile` and friends. The
pages are reordered to match the screen order on every run, ahead of any other page in the file.

## What it draws

| # | Frame | Contents |
|---|---|---|
| 01 | หน้าแรก | hero + รูปพี่ที, countdown, "เราทำอะไร", ราคา 3 แพ็ก, ผลคะแนนรุ่นพี่ |
| 02 | รู้จักพี่ที | hero, แถบวุฒิ, 3 เหตุผลพร้อมช่องใส่รูป, ไทม์ไลน์, แชทผู้ปกครอง, FAQ |
| 03 | เข้าสู่ระบบ | Google OAuth สองคอลัมน์ |
| 04 | เมนูหลัก | สถิติ 4 ช่อง, เมนู 6 การ์ด |
| 05 | คอร์ส & ข้อสอบ | รายการขาย + การันตีคืนเงิน |
| 06 | รายละเอียดคอร์ส | คลิปแนะนำ, เนื้อหา 5 หมวด, กล่องสั่งซื้อ |
| 07 | ชำระเงิน | ข้อมูลผู้เรียน, วิธีชำระเงิน, สรุปยอด |
| 08 | ชำระเงินสำเร็จ | เปิดสิทธิ์อัตโนมัติ, ลิงก์กลุ่ม LINE, ใบสรุปคำสั่งซื้อ |
| 09 | ทำข้อสอบ | ทีละข้อ, ปักธง, MSG box, แถบ 5 วิชา, พักไว้ก่อน, ล้างคำตอบ, ตารางธง 100 ข้อ, เช็กลิสต์ก่อนส่ง, บันทึกอัตโนมัติ, จับเวลา |
| 10 | สรุปคะแนน | คะแนนรวม, คะแนนรายบท, คำแนะนำ |
| 11 | ดูดวง — กรอกข้อมูล | ฟอร์มบนพื้นม่วง + ช่องพิมพ์คำถามเอง พร้อมตัวอย่างให้กด |
| 12 | ดูดวง — ชำระเงิน | ทวนข้อมูลที่กรอก, คำถามที่ถาม, วิธีชำระเงิน, คำยินยอมผู้ปกครอง, สรุปยอด |
| 13 | ดูดวง — คำทำนาย | ตอบคำถามที่ถาม, คำทำนาย 3 ด้าน, เลขนำโชค, ข้อความกำกับ |

Footers come in two forms. Screens 01, 02, 04-08 and 10 get the full `siteFooter` with menu
columns and the client note. Screens 03, 09, 11, 12 and 13 get `slimFooter` — the two copyright
lines only — so login, the exam and the fortune module stay focused.

Frames that need a real photo are named `PLACEHOLDER · …` and state the aspect ratio to shoot,
so you can search the layer list for `PLACEHOLDER` to find every one of them.

## Re-running and cleanup

Every frame and label is named with the prefix `PT · `. Each run removes everything it made
previously — across every page in the file, not just the current one — then draws again. So edit
`code.js`, run again, and you get a clean update rather than duplicates. If you ran an older build
that made separate `🖥 Desktop` / `💻 Tablet` / `📱 Mobile` pages, the next run empties them; the
empty pages themselves are left for you to delete by hand.

Frames from before this plugin (`Desktop / 01 Landing` and friends) are left alone by default and
the new work is placed below them. To delete those too, set the first line of `code.js`:

```js
var DELETE_LEGACY_SCREENS = true;
```

## How responsive works

There is one function per screen, not one per screen per width. `setBreakpoint()` rewrites the
globals `W`, `PAD`, `NARROW` and `MOBILE` before each pass, and the layout helpers read them:

- `flex(gap, opts)` — a row on desktop, a column on tablet and mobile.
- `flex2(gap, opts)` — a row until phone width, so a tablet keeps it side by side.
- `grid(parent, gap, n)` — a row of equal cards: n across on desktop, two on tablet, stacked on a
  phone. Children appended with `add()` are sized to their column automatically.
- `capW(node, w)` — a fixed width that is never wider than the content box.
- `railW(node, w)` — a side rail: 300 on tablet, `w` on desktop, and full width when it finds
  itself inside a stacked column.
- `bpv(desktop, tablet, mobile)` — pick a value per breakpoint.
- `fit(size)` — display type steps down to 84% on tablet and 68% on mobile. `h1`-`h4` apply it
  automatically; plain `txt()` does not.

So a new screen only needs writing once. Reach for `flex` rather than `row` whenever the row is
a page-level split, `grid` for card rows, and for any hardcoded width use `capW` instead of `resize`.

### Where tablet and mobile differ

Tablet is not a wide phone. The two breakpoints part company here:

| | Tablet 834 | Mobile 430 |
|---|---|---|
| Header | all six nav links, tighter spacing and 13.5px type | current page as a chip + hamburger |
| Card grids | two across, wrapped | one per row |
| Main + summary rail | side by side, rail pinned to 300 | stacked, rail full width |
| Exam side panel | stacked under the question, then split into two columns | one column |
| Footer link columns | three across | stacked |
| Form field pairs | two across | one per row |
| Display type | 84% | 68% |
| Section padding | 75% | 55% |
| Gutter | 40 | 20 |

One trap worth knowing: `node.resize(w, h)` pins **both** axes of an auto-layout frame. Sizing a
card by width before its content goes in freezes its height at empty, and everything added
afterwards is clipped. Use `capW`/`railW`/`add()`, which hand the height back to the layout via
`hugHeight()`, rather than calling `resize` directly on a container.

`node smoke-test.js` runs every menu command at every breakpoint against a stub Figma API, checks
that the manifest menu and the `SCREENS` array still agree, and reports runtime errors. It also
mirrors Figma's resize-pins-both-axes behaviour and fails on two layout faults: a child that hangs
out of a fixed-size parent, and an auto-layout frame whose pinned height its own content outgrows.

## Draft notes from the client PDF

Applied to the landing screen (`design-pipoltutor-webapp.pdf`, handwritten markup):

| Note | What changed |
|---|---|
| กล่องตัวเลขนับถอยหลังเปลี่ยนเป็นสีส้มตอนใกล้สอบได้ไหม | Yes — `COUNTDOWN_DAYS` at the top of `code.js`; at or under `URGENT_DAYS` (30) the tiles go accent orange. Set it under 30 to draw that state |
| ใช้คำว่า "ข้อสอบจำลอง 100 ข้อ" | Hero float chip reworded |
| เพิ่มปุ่มสมัคร / ปุ่มรายละเอียด ในการ์ดราคาทุกใบ | Every plan card now stacks a ghost "ดูรายละเอียด" over a primary signup button (`cta` + `cta2` in `PLANS`) |
| user ที่ Login ได้อะไรมากกว่า | A benefit line under the hero trust chips spells it out |

## Editing

`code.js` is plain ES5 in three parts: design tokens and layout helpers at the top, reusable
blocks (header, footer, cards, plan cards) in the middle, and one function per screen at the
bottom. Copy text lives inline in those screen functions.

Colors are in the `C` object at the top — changing a token there restyles every screen. A new
token needs a night-mode counterpart in `DARK_SURFACE` and, if it is ever used as a text colour,
in `DARK_TEXT`; an unmapped value simply passes through unchanged and will look wrong on dark.

## Note on content

Every name, photo, statistic, score, review and message in these screens is placeholder content
written for the design. Replace it with real material before the site goes live, and get a
parent's permission before using any student's photo or words.
