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
- Exam pack: 590 THB. Full course: 4,900 THB. Course + all packs: 5,200 THB. These are the seeded
  starting prices; the live prices are whatever the admin sets under สินค้าและราคา (DB is the truth).
- Payment gateway: Omise (Opn Payments), PromptPay QR and card. Paid access unlocks automatically via
  an entitlement, and the success page shows the LINE link (admin-editable text `brand.line_url`).
- Login is Google OAuth only.

## Constraints
- Responsive: phone and desktop both first-class.
- The app is built (backend, student site, admin dashboard); see README.md. The Figma file remains the
  design truth for visuals.
- Thai typography must hold at every size (tone marks and upper/lower vowels stack above and below
  the baseline, so line height and font choice matter more than in Latin-only work).

## ASSUMPTIONS — invented placeholder content, not confirmed by the client
The tutor has not supplied real copy, photos, or biography. Everything below is placeholder authored
for the design and must be replaced before launch:
- Instructor name "พี่พิพล", the claim that he is a จภ. alumnus, and his biography.
- All numbers used as proof: 6 cohorts, 120+ students, 40 seats per cohort, pass rates.
- All testimonials and student names.
- The exam date and the countdown built on it. Stored in exam_settings and editable in admin
  (วันสอบและเวลา); the seeded date is a placeholder.
- The fortune-telling module's prediction rules (the client owes these). Today the reading is
  rule-based facts plus Cloudflare Workers AI prose, falling back to rule text when AI is off.
- The fortune-telling topics and prices: ดูดวงการสอบ 99 THB, ดูดวงเลือกสนามสอบ 149 THB, ดูดวงรวม 199 THB.
  Topic names and prices were invented by the developer; the client has not confirmed either. Admin can
  change prices and add or retire topics. The earlier 3-reading pack and 20 THB course-member discount
  were never built (the pack product is inactive).
- The parent-consent gate on the fortune checkout, which assumes the client wants a parent to confirm
  any purchase made by a student under 15.
