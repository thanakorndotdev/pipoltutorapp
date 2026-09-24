# PIPOL TUTOR

A single-tutor website that sells prep for the จภ. (Princess Chulabhorn Science High School) M.1 entrance exam. It has courses, timed mock exams graded on the server, and a paid fortune-telling (ดูดวง) module. The site is in Thai. Product background, pricing and placeholder assumptions are in [PRODUCT.md](PRODUCT.md).

## Repository layout

| Path | What it is |
| --- | --- |
| `backend/app` | API: Bun + ElysiaJS + Drizzle ORM over Postgres |
| `frontend/pipoltutor-app` | Student-facing site: Next.js 16, React 19, Tailwind v4 |
| `frontend/admin` | Admin dashboard: Next.js app, **not deployed**; run locally with `bun run dev` |
| `docker/` | `docker-compose.yml`, Dockerfiles, `Caddyfile`, `.env.example` |
| `db/init.sql` | Runs once on an empty Postgres volume (extensions only) |
| `figma-plugin/` | Figma plugin that holds the design truth (tokens, 13 screens) |
| `.claude/skills/` | Project conventions (backend, frontend, exam engine, Thai UI, migrations, running the stack) |

## How requests flow

```
browser ──https──> Caddy (:443)
                    ├── /api/*   → backend:3001   (the /api prefix is stripped)
                    └── else     → frontend:3000  (Next.js)
backend ──> Postgres (published on 127.0.0.1:5432 only)
```

The frontend's server components call the backend directly at `BACKEND_URL`. Browser code always calls the same-origin `/api/*`.

## First-time setup

```bash
cp docker/.env.example docker/.env      # then fill in the values below
docker compose -f docker/docker-compose.yml up -d --build
cd backend/app && bun install && bun run db:seed    # products, exam settings, sample pack
```

The site is at `https://localhost`. The admin is not deployed; see the admin section below. The certificate is self-signed, so use `curl -k`.

### `docker/.env`

This file is the single source of config. Compose reads it, and host-side runs read it through `backend/app/src/db/env.ts`.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Database |
| `BACKEND_PORT` | Backend port (default 3001) |
| `ADMIN_API_KEY` | Static admin key, sent as the `x-admin-key` header. Generate one with `openssl rand -hex 32` |
| `ADMIN_EMAILS` | Comma-separated emails that get role `admin` on their first Google sign-in |
| `ALLOW_DEV_AUTH` | `1` makes the backend accept an `x-dev-user-email` header as a login. **Never set this in production** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (redirect URIs are listed in `.env.example`) |
| `PUBLIC_URL` / `PUBLIC_URL_DOCKER` | Origin the browser sees. Used for the OAuth redirect and Secure cookies |
| `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` | Payments (PromptPay and card). Webhook: `<PUBLIC_URL>/api/webhooks/omise` |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_AI_MODEL` | Workers AI writes the fortune prose. If empty, the rule-based text is used |

**Still owed by the client:** real Google, Omise and Cloudflare keys, plus real copy and photos (see the ASSUMPTIONS section of PRODUCT.md).

## Day-to-day development

### Host dev loop (fastest)

Only Postgres runs in Docker. Everything else runs on the host with hot reload.

```bash
docker compose -f docker/docker-compose.yml up -d postgres
cd backend/app            && bun run dev   # http://localhost:3001  (no /api prefix)
cd frontend/pipoltutor-app && bun run dev  # http://localhost:3000
cd frontend/admin         && bun run dev   # http://localhost:3002/admin/  (proxies /api → :3001)
```

Run **only one** backend on port 3001. A stale `bun run src/index.ts` left running on the same port serves old code, and the admin then shows `"NOT_FOUND" is not valid JSON`. To check, run `lsof -iTCP:3001 -sTCP:LISTEN`, kill the extras, and start `bun run dev` again.

### Docker stack

The source is baked into the images, so a code change is not live until you rebuild:

```bash
docker compose -f docker/docker-compose.yml up -d --build backend frontend
docker compose -f docker/docker-compose.yml logs -f backend
docker compose -f docker/docker-compose.yml down        # keeps the DB volume
```

### Health checks

```bash
curl -sk https://localhost/api/health     # {"status":"ok","db":"up"}; 503 + driver error if Postgres is down
curl -sk https://localhost/api/products
```

## Database

The schema lives in `backend/app/src/db/schema.ts`. Migrations are in `backend/app/drizzle/`, and the container runs `db:migrate` on start.

```bash
cd backend/app
bun run db:generate   # after editing schema.ts; review the SQL it writes
bun run db:migrate    # apply
bun run db:seed       # idempotent seed
bun run db:studio     # browse data
```

What the seed does:
- **Products** are inserted once (`onConflictDoNothing`). After that the admin panel owns title, price and on/off status, and a re-seed never overwrites them. A product you delete in admin comes back if its slug is in the seed catalogue.
- **Exam settings** are inserted once and never overwritten.
- It adds the `mock-100` sample pack and a starter question bank, but only if the bank is empty.

## Admin dashboard (`/admin`)

The admin is **not deployed**: Caddy has no `/admin` route and compose mounts nothing for it. Run it on your own machine and point it at a backend:

```bash
cd frontend/admin && bun install && bun run dev    # http://localhost:3002/admin/
# talks to http://localhost:3001 by default; for another backend:
BACKEND_URL=https://your-domain/api bun run dev
```

Against a remote backend, sign in by pasting `ADMIN_API_KEY`. Google sign-in only works when the admin and the backend share an origin.

The admin API (`/api/admin/*`) is still live on every deployment, protected by `ADMIN_API_KEY` or an admin session, so the terminal recipes below work against production too.

To sign in, use Google with an admin-role account, or paste `ADMIN_API_KEY` on the gate screen.

| Page | What you can do |
| --- | --- |
| ภาพรวม | Stats |
| คลังข้อสอบ | Question bank: create, edit and deactivate questions; upload figures |
| ชุดข้อสอบ | Exam packs: title, slug, question count, duration, which products unlock them (none = free), and question order |
| สินค้าและราคา | Products: add, edit title/description/price/on-off, delete |
| วันสอบและเวลา | Exam date, enrollment close, countdown urgency, time multiplier (150% = 1.5× the pack time) |
| รูปภาพเว็บไซต์ / ข้อความเว็บไซต์ | CMS for site images and copy |
| ผู้ใช้และสิทธิ์ | Users and roles (admin / dev / test / student) |

### Products and prices

- **Prices** are whole baht, minimum 20 THB (the Omise limit). A new price applies to orders created afterwards. Pending orders keep the price they were created with.
- **Slug and kind** cannot change after creation, because checkout links (`/checkout?product=<slug>`) and unlock logic use them.
- **Deleting** only works if nobody has bought the product. If it has any order or entitlement, delete returns 409; use **ปิดขาย** (inactive) instead. This protects students' paid access.
- **Kinds:**
  - `exam_pack` / `course` / `bundle` can unlock exam packs. The three landing-page price cards (`exam-pack`, `full-course`, `course-plus-packs`) show the DB price, but the card list itself is hardcoded in `frontend/pipoltutor-app/lib/content.ts` (`PLANS`), so a new course needs a code change to get a card.
  - `fortune`: every **active** fortune product is a topic with its own price on `/fortune`. Currently: ดูดวงการสอบ, ดูดวงเลือกสนามสอบ, ดูดวงรวม. The topic title is passed to the AI prompt.

## Doing admin tasks from the terminal

The admin dashboard is only a UI over the admin API, so anything it does can also be done with `curl`. Every example uses `jq`, which ships with macOS.

### Setup (once per terminal)

```bash
cd ~/pipoltutorapp
export KEY=$(grep '^ADMIN_API_KEY=' docker/.env | cut -d= -f2-)

# Pick ONE base URL:
export API=http://localhost:3001          # host dev loop (backend running with bun run dev)
# export API=https://localhost/api        # Docker stack through Caddy

# Short helper: adm METHOD PATH [JSON]
adm() { curl -sk -X "$1" "$API$2" -H "x-admin-key: $KEY" -H 'content-type: application/json' ${3:+-d "$3"}; }

adm GET /admin/stats | jq      # smoke test: prints stats, not {"error":...}
```

`"NOT_FOUND"` means the backend is running old code (see the host dev loop above). `401` means `KEY` is empty or wrong.

### Prices and products

```bash
# List every product with its id and price (satang)
adm GET /admin/products | jq -r '.products[] | [.id, .slug, .kind, .priceSatang/100, .active] | @tsv'

# Id of one product by slug
PID=$(adm GET /admin/products | jq -r '.products[] | select(.slug=="full-course") | .id')

# Change only the price to 4,500 THB. PUT needs every editable field (price = whole baht x 100,
# minimum 2000), so copy the current row and override priceSatang:
BODY=$(adm GET /admin/products | jq -c --arg id "$PID" '.products[] | select(.id==$id) | {title, description, priceSatang: 450000, active}')
adm PUT /admin/products/$PID "$BODY" | jq

# Or write the whole row yourself:
adm PUT /admin/products/$PID '{"title":"คอร์สติวเต็ม","description":null,"priceSatang":450000,"active":true}' | jq

# Stop selling (keeps history; use this instead of delete once anyone bought it)
adm PUT /admin/products/$PID '{"title":"คอร์สติวเต็ม","description":null,"priceSatang":450000,"active":false}' | jq

# Add a product (kind: course | exam_pack | bundle | fortune). A fortune product = a new ดูดวง topic.
adm POST /admin/products '{"slug":"fortune-love","kind":"fortune","title":"ดูดวงความรัก","description":null,"priceSatang":12900,"active":true}' | jq

# Delete (only works if nobody ever ordered it; otherwise 409)
adm DELETE /admin/products/$PID | jq
```

A new price only applies to orders created after the change. The public price list is `curl -sk $API/products | jq`.

### Exam sheets (ชุดข้อสอบ)

An exam sheet has two parts: the **pack** (title, time, which products unlock it) and its **ordered list of questions**, which come from the question bank.

**1. Add questions to the bank.** `subject` is one of `math`, `science`, `general_aptitude`, `thai`, `english`.

```bash
adm POST /admin/questions '{
  "subject": "math",
  "topic": "อัตราส่วน",
  "prompt": "ถ้า a:b = 2:3 และ b:c = 4:5 แล้ว a:c เท่ากับเท่าใด",
  "choices": [
    {"key":"ก","text":"8:15"}, {"key":"ข","text":"2:5"},
    {"key":"ค","text":"6:5"},  {"key":"ง","text":"3:4"}
  ],
  "correctChoice": "ก",
  "explanation": "a:b:c = 8:12:15",
  "active": true
}' | jq '.question.id'
```

To load many at once, put them in a JSON array file (for example `questions.json`, where each item has the shape above) and loop over it:

```bash
jq -c '.[]' questions.json | while read -r q; do
  adm POST /admin/questions "$q" | jq -r '.question.id // .error'
done > new-question-ids.txt
```

To use a picture in a question, upload it first and put the returned URL in `"imageUrl"`:

```bash
curl -sk -X POST "$API/admin/uploads" -H "x-admin-key: $KEY" -F "file=@figure1.png" | jq -r .url
# -> /api/uploads/<name>.png
```

Other question commands:

```bash
adm GET '/admin/questions?subject=math&limit=200' | jq -r '.questions[] | [.id, .topic, .prompt[0:40]] | @tsv'
adm GET '/admin/questions?q=อัตราส่วน' | jq '.total'
adm GET /admin/questions/topics | jq
adm PUT /admin/questions/<id> '<full question JSON, same shape as POST>' | jq
adm DELETE /admin/questions/<id> | jq       # 409 while it is still in a pack; set "active": false instead
```

**2. Create the pack.** `productIds` lists the products that unlock it; `[]` makes it a free pack. `durationSeconds` is the base time, and students get that time multiplied by the percentage set in วันสอบและเวลา.

```bash
BUNDLE=$(adm GET /admin/products | jq -r '.products[] | select(.slug=="course-plus-packs") | .id')
EXAMPACK=$(adm GET /admin/products | jq -r '.products[] | select(.slug=="exam-pack") | .id')

PACK=$(adm POST /admin/packs "{
  \"slug\": \"mock-2\",
  \"title\": \"ข้อสอบเสมือนจริง ชุดที่ 2\",
  \"productIds\": [\"$BUNDLE\", \"$EXAMPACK\"],
  \"questionCount\": 100,
  \"durationSeconds\": 5400
}" | jq -r '.pack.id')
echo $PACK
```

**3. Put questions in the pack.** This call **replaces** the whole list, and the order of the array is the order on the exam. Only active questions are allowed, with no duplicates.

```bash
# From the file written by the bulk import above
IDS=$(jq -R . new-question-ids.txt | jq -sc .)
adm PUT /admin/packs/$PACK/questions "{\"questionIds\": $IDS}" | jq '.pack.assigned'

# Append to what is already there instead of replacing
OLD=$(adm GET /admin/packs/$PACK/questions | jq -c '[.questions[].id]')
NEW=$(jq -R . new-question-ids.txt | jq -sc .)
adm PUT /admin/packs/$PACK/questions "{\"questionIds\": $(jq -nc --argjson a "$OLD" --argjson b "$NEW" '$a + $b')}" | jq '.pack.assigned'
```

Other pack commands:

```bash
adm GET /admin/packs | jq -r '.packs[] | [.id, .slug, .title, .assigned, .questionCount] | @tsv'
adm GET /admin/packs/$PACK | jq
adm PUT /admin/packs/$PACK '<same JSON shape as POST>' | jq      # edit title, time, unlocking products
adm DELETE /admin/packs/$PACK | jq                                # 409 once any student has attempted it
```

### Exam date and time multiplier

Every field is optional; send only the ones you want to change. Dates use Thai time (`+07:00`).

```bash
adm GET /settings/exam | jq
adm PUT /settings/exam '{"examDate":"2027-01-24T00:00:00+07:00","enrollCloseAt":"2027-01-10T23:59:59+07:00"}' | jq
adm PUT /settings/exam '{"timeMultiplierPercent":150,"urgentDays":30,"examVenueLabel":"จภ."}' | jq
```

### Users and roles

```bash
adm GET '/admin/users?q=gmail' | jq -r '.users[] | [.id, .email, .role] | @tsv'
adm PATCH /admin/users/<user-id> '{"role":"admin"}' | jq     # admin | dev | test | student
```

A user must have signed in with Google once before they appear in this list. Adding an email to `ADMIN_EMAILS` makes that person an admin on their first sign-in.

### Site text and images (CMS)

```bash
adm GET /admin/site/texts | jq -r '.slots[] | [.key, (.override.value // "(default)")] | @tsv'
adm PUT /admin/site/texts/brand.line_url '{"value":"https://line.me/R/ti/g/XXXX"}' | jq
adm DELETE /admin/site/texts/brand.line_url | jq      # back to the default

adm GET /admin/site/assets | jq -r '.slots[].key'
URL=$(curl -sk -X POST "$API/admin/uploads" -H "x-admin-key: $KEY" -F "file=@hero.jpg" | jq -r .url)
adm PUT /admin/site/assets/<slot-key> "{\"imageUrl\":\"$URL\",\"alt\":\"พี่พิพล\"}" | jq
```

### Straight to the database

Use this for things the API doesn't cover, such as giving a student access by hand or checking orders:

```bash
set -a; . docker/.env; set +a
psql() { docker exec -i app_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

psql -c "select o.created_at, u.email, p.slug, o.status, o.amount_satang/100 as baht
         from orders o join users u on u.id=o.user_id join products p on p.id=o.product_id
         order by o.created_at desc limit 20;"

# Grant a product to a student without payment (unlocks its packs)
psql -c "insert into entitlements (user_id, product_id)
         select u.id, p.id from users u, products p
         where u.email='student@example.com' and p.slug='course-plus-packs'
         on conflict do nothing;"
```

Always prefer the API or dashboard for anything they cover, because they validate input. Before you run raw SQL that changes data, back up the database: `docker exec app_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql`.

## How the main features work

**Auth:** Google OAuth creates a server-side session cookie. Roles are in `users.role`. Staff roles (admin, dev, test) bypass payment for exams and fortune.

**Checkout and payment:** `POST /orders` creates a pending order at the current DB price. Omise charges it (PromptPay QR or card). The webhook or `/payments/sync` marks the order paid and grants an entitlement, which unlocks the content.

**Exam engine** (rules in `.claude/skills/exam-engine-rules`):
- The answer key never leaves the server.
- The server owns the clock: allowed time = pack duration × multiplier.
- Answers and flags autosave, grading is server-side, and results show a per-topic breakdown.

**Fortune (ดูดวง):**
- **Access:** unlocked by a paid order, not an entitlement, because each reading is bought separately.
- **Generation:** the text is generated lazily on the first read after payment. It uses Cloudflare Workers AI, with a rule-based fallback if the AI fails or isn't configured.

## API overview

Every path below is behind `/api` when going through Caddy.

| Area | Endpoints |
| --- | --- |
| Public | `GET /health`, `GET /products`, `GET /campuses`, `GET /settings/exam`, `GET /site/assets`, `GET /site/texts`, `GET /uploads/:name` |
| Auth | `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/me`, `POST /auth/logout` |
| Student | `/orders`, `/payments/charge`, `/payments/sync`, `/entitlements`, `/exam-packs`, `/attempts`, `/fortune/readings` |
| Webhook | `POST /webhooks/omise` |
| Admin (`x-admin-key` or admin session) | `/admin/stats`, `/admin/questions`, `/admin/packs`, `/admin/products`, `/admin/users`, `/admin/site`, `/admin/uploads`, `PUT /settings/exam` |

## Conventions

The detailed rules live in `.claude/skills/*/SKILL.md`:
- `backend`: routes, validation, errors, and what must never be serialized
- `frontend`: Next.js structure
- `thai-ui`: fonts (Mitr/Anuphan), line height for Thai tone marks, THB and Buddhist-era date formatting
- `design-system`: tokens and screens
- `drizzle-migrate`: the schema-change workflow

Money is always stored as **integer satang** (`priceSatang`, `amountSatang`) and shown as whole baht.
