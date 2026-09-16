# PRODUCT.md — PIPOL TUTOR

## What it is
A single-tutor website selling prep courses for the Princess Chulabhorn Science High School
(โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย, "จภ.") M.1 entrance exam in Thailand. One tutor, one brand,
no marketplace. Language: Thai.

## Unique mechanism
Server-side exam engine: a 100-question mock exam that mirrors the real entrance exam — one question
per slide, timed, per-question flag states (grey = untouched, green = answered, red = flagged for
review), answers autosaved to the server, and grading performed entirely server-side so the answer key
never reaches the browser (F12 / Network / View Source reveal nothing). Results come back as a
per-topic breakdown of what to fix.

## Audience and scene
- Primary: Thai students in M.6 (aged ~11-12) preparing for the จภ. entrance exam.
- Secondary and the actual payer: their parents, who decide whether this tutor is worth 4,900 THB.
- Scene: evening, at home, on a phone or a shared family laptop. Parent and child often look together.

## Surfaces in scope
Landing, About (instructor profile), Google-OAuth login, post-login menu/index, course + exam-pack
sales pages, checkout, payment success (auto-unlock + LINE group invite link), exam engine, score
report, and a fortune-telling ("ดูดวง") module — form, checkout, plus prediction result.

## Commercial truth
- Exam pack: 590 THB. Full course: 4,900 THB. Course + all packs: 5,200 THB.
- Payment gateway not yet chosen. Paid access unlocks automatically and issues a LINE group link.
- Login is Google OAuth only.

## Constraints
- Responsive: phone and desktop both first-class.
- Deliverable right now is Figma design only; no application code yet.
- Thai typography must hold at every size (tone marks and upper/lower vowels stack above and below
  the baseline, so line height and font choice matter more than in Latin-only work).

## ASSUMPTIONS — invented placeholder content, not confirmed by the client
The tutor has not supplied real copy, photos, or biography. Everything below is placeholder authored
for the design and must be replaced before launch:
- Instructor name "พี่พิพล", the claim that he is a จภ. alumnus, and his biography.
- All numbers used as proof: 6 cohorts, 120+ students, 40 seats per cohort, pass rates.
- All testimonials and student names.
- The exam date 25 January 2569 and the countdown built on it.
- The fortune-telling module's prediction rules (the client owes these).
- The fortune-telling price (99 THB per reading, 249 THB for a 3-reading pack, 20 THB course-member
  discount). The client has not set a price for this module; these numbers exist only so the checkout
  screen has something to show.
- The parent-consent gate on the fortune checkout, which assumes the client wants a parent to confirm
  any purchase made by a student under 15.
