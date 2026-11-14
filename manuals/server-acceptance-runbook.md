# Runbook ตรวจรับบนเครื่อง Server — SoW 2026

จัดทำ 2026-11-14 ใช้คู่กับ `acceptance-matrix.md`, `operations-guide.md` และ `sow-requirement-response.md`

เอกสารนี้คือขั้นตอนที่ต้องทำบนเครื่อง server จริง เพื่อปิดข้อตรวจรับที่เครื่องพัฒนาทำแทนไม่ได้ ได้แก่ **AC-01, AC-05, AC-21, AC-23 (บนโฮสต์), AC-25, AC-39, AC-40** และงานที่ Owner ต้องตัดสินใจ ทำตามลำดับหัวข้อ แล้วบันทึกผลลงตาราง "บันทึกผล" ท้ายเอกสาร

> **ห้ามทำ**
> - ใส่ค่าลับ (`docker/.env`, private key, age identity, ADMIN_API_KEY) ลงใน repository, รูปหลักฐาน หรือ chat — repository นี้เป็น **public**
> - commit ไฟล์ผลทดสอบที่มีข้อมูลนักเรียนจริง ผลจากสคริปต์ใน `backend/app/scripts` ใช้บัญชีจำลองทั้งหมด แต่ต้องเปิดอ่านก่อน commit ทุกครั้ง
> - ใช้ `db:push`, `docker compose down -v` หรือ restore ทับฐานข้อมูลที่ใช้งานอยู่
> - เปลี่ยนสถานะใน `acceptance-matrix.md` เป็น production PASS โดยไม่มีหลักฐานตามข้อ 11.3

---

## 0. สิ่งที่ต้องมีก่อนเริ่ม

| รายการ | ใครเตรียม | หมายเหตุ |
|---|---|---|
| เครื่อง Linux ที่มี Docker Engine + Compose v2, git | Owner/Dev | สเปกที่จะใช้จริง เพราะ AC-40 ต้องวัดบนเครื่องนี้ |
| DNS A/AAAA ของโดเมนชี้มาที่เครื่อง, เปิดพอร์ต 80/443 | Owner | Caddy ออกใบ HTTPS เอง |
| Google OAuth client (Web) ในบัญชี Google Cloud ของ Owner | Owner | Redirect URI: `https://<โดเมน>/api/auth/google/callback` |
| บัญชี Google จริง 3 บัญชี: Owner A, Owner สำรอง B, นักเรียน C (และ D ถ้าทำ AC-01 แยก) | Owner | ไม่ใช้บัญชีนักเรียนจริงที่มีข้อมูลอยู่ |
| age key pair สำหรับ backup | Owner | สร้างบนเครื่องของ Owner **ไม่ใช่บน server**: `age-keygen -o pipol-backup.key` เก็บ identity ไว้กับ Owner, นำเฉพาะบรรทัด `public key: age1...` มาใช้ |
| ปลายทาง off-site สำหรับ backup/WAL | Owner | เช่น object storage อีกผู้ให้บริการ — ต้องเลือกก่อนประกาศ RPO |
| มือถือ 2 เครื่อง (iOS/Android), เครื่องพิมพ์, แอป LINE | Owner/Dev | AC-05, AC-21 |
| Bun บน host (สำหรับรันสคริปต์ทดสอบ) | Dev | `curl -fsSL https://bun.sh/install \| bash` แล้ว `cd backend/app && bun install` |

---

## 1. Deploy

### 1.1 ครั้งแรกบนเครื่องใหม่

```sh
git clone https://github.com/thanakorndotdev/pipoltutorapp.git /opt/pipoltutorapp
cd /opt/pipoltutorapp
cp docker/.env.example docker/.env
chmod 600 docker/.env
```

แก้ `docker/.env` อย่างน้อย:

```sh
POSTGRES_PASSWORD=<openssl rand -hex 24>
ADMIN_API_KEY=<openssl rand -hex 32>
ADMIN_EMAILS=<อีเมล Owner A>
OWNER_EMAILS=<อีเมล Owner A>,<อีเมล Owner B>
ALLOW_DEV_AUTH=0
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SITE_ADDRESS="pipoltutor.org, www.pipoltutor.org"
PUBLIC_URL_DOCKER=https://pipoltutor.org
BACKUP_AGE_RECIPIENT=age1...        # public recipient เท่านั้น
BACKUP_INTERVAL_SECONDS=86400
```

`PUBLIC_URL_DOCKER` ต้องเป็นโดเมนจริง **ก่อนออกเกียรติบัตรใบแรก** เพราะ URL ใน QR ถูกลงนามไว้ในใบ

```sh
docker compose -f docker/docker-compose.yml -f docker/docker-compose.backup.yml config --quiet
docker compose -f docker/docker-compose.yml -f docker/docker-compose.backup.yml up -d --build
```

### 1.2 อัปเดตเครื่องที่มีระบบเดิมอยู่แล้ว

```sh
cd /opt/pipoltutorapp
BACKUP_DIR=/opt/backups sh docker/deploy.sh
```

สคริปต์ปฏิเสธถ้ามีคนสอบอยู่ (ใช้ `FORCE=1` เมื่อจำเป็น), สำรอง DB + uploads + certificates + cert-keys, pull, build, สลับ และรอ `/health`. Migration 0017–0024 รันเองตอน backend เริ่ม และเป็นแบบเพิ่มอย่างเดียว

หลัง deploy ครั้งแรกที่มี SoW ให้เปิด backup overlay ด้วยคำสั่ง `up -d --build` ในข้อ 1.1 ต้องตั้ง `BACKUP_AGE_RECIPIENT` ก่อน (ไม่ตั้งแล้ว compose จะไม่ยอมรัน) และ overlay เปลี่ยน `command` ของ postgres ทำให้ container ฐานข้อมูลถูกสร้างใหม่และหยุดไม่กี่วินาที ให้ทำตอนไม่มีคนสอบ (ใช้คำสั่งตรวจในขั้นที่ 1/6 ของ `deploy.sh`) ระบบยังไม่ลบ bundle เก่าหรือ WAL เอง ต้องเฝ้าดูพื้นที่ volume `backups_data` / `wal_archive` จนกว่า Owner จะอนุมัติรอบเก็บ

### 1.3 Smoke check

```sh
curl -fsS https://pipoltutor.org/api/health          # ต้องมี "db":"up"
curl -sI http://pipoltutor.org | head -3              # ต้อง redirect ไป https
curl -sI https://pipoltutor.org | grep -i strict-transport
curl -fsS https://pipoltutor.org/sitemap.xml | head
docker compose -f docker/docker-compose.yml logs --tail 50 backend   # ไม่มี error ซ้ำ ๆ
docker compose -f docker/docker-compose.yml exec -T backend ls -la /app/cert-keys   # ว่างจนกว่าจะออกใบแรก จากนั้นมี PEM สิทธิ์ -rw------- (0600)
```

ผ่านเมื่อ: health ตอบ `db: up`, HTTPS ใช้ได้, sitemap มีบทความที่เผยแพร่ (ถ้ามี) และเปิด `https://<โดเมน>/admin/` ได้

signing key ถูกสร้างตอนออกเกียรติบัตรใบแรก (`src/certificates/keys.ts`) ไม่ใช่ตอน deploy หลังออกใบแรกให้สำรอง volume `cert_keys_data` แยกจากฐานข้อมูลทันที

---

## 2. ตั้งค่าของ Owner (ทำก่อนตรวจ AC)

1. ตรวจว่า `OWNER_EMAILS` ใน `docker/.env` มีอีเมล Owner A และ B แล้วส่งเข้า backend จริง: `docker compose -f docker/docker-compose.yml exec -T backend printenv OWNER_EMAILS` ถ้าว่าง admin ทุกคนจะได้ 403 ที่หน้าผู้ใช้และสิทธิ์ (admin จัดการผู้ใช้ไม่ได้ มีแต่ Owner) แก้ `.env` แล้วรัน `docker compose -f docker/docker-compose.yml up -d backend`
2. Owner A login ด้วย Google ที่หน้าเว็บ แล้วเข้า `/admin/` → ผู้ใช้และสิทธิ์ แล้วบันทึก role **Owner** ให้ทั้งบัญชี A และ B ในฐานข้อมูล — SoW 8.2 ต้องมี Owner อย่างน้อยสองบัญชี เมื่อบันทึกแล้ว role ในฐานข้อมูลใช้แทนค่าใน `OWNER_EMAILS`
3. ทดสอบ last-Owner guard: ลองถอด Owner ทั้งสองบัญชี ระบบต้องไม่ยอมให้เหลือ 0
4. หน้า Operations → Retention: ทบทวนค่าเสนอ (technical logs 30 วัน, หมวดอื่น 365 วัน) แก้ตามที่ Owner ต้องการ แล้วกด **อนุมัติ** บันทึก version ที่อนุมัติ
5. Certificates → ตรวจว่ามี signing key ที่ active และ key history; Owner เท่านั้นเห็นปุ่มหมุน key
6. ตั้ง backup off-site: ส่งไฟล์ `.tar.gz.age` และ WAL ออกไปปลายทางที่ Owner เลือก (ระบบส่งออกอัตโนมัติยังไม่มี — ต้องตั้ง sync เช่น `rclone` จาก volume backup ด้วย credential ของ Owner) จนกว่าจะเสร็จ **ห้ามประกาศ RPO 60 วินาที** เพราะ WAL อยู่บนเครื่องเดียวกัน
7. เก็บ age identity, ADMIN_API_KEY และรหัส DB ไว้ใน password manager ของ Owner ไม่ใช่บน server อย่างเดียว

---

## 3. AC-01 — บัญชี Google A/B เข้าถึงข้อมูลกันไม่ได้

เตรียม: บัญชี C และ D (นักเรียนทดสอบ) กรอกโปรไฟล์ให้ครบ

1. C login → ทำข้อสอบชุดที่เปิดออกเกียรติบัตร 1 ชุดจนส่ง → ทำโจทย์ประจำวันให้ได้ไฟ → รอเกียรติบัตรออก
2. C จด URL ผลสอบ (`/exam/result?...`), URL เกียรติบัตรใน Dashboard (`/dashboard/certificate/<id>`) และ id ไฟล์ PNG/PDF
3. เปิด Chrome profile อื่น (หรือ incognito) login ด้วย D แล้วเปิดทุก URL ของ C
4. ใน DevTools (Console) ของ D เรียก API ด้วย attempt id ของ C ตรง ๆ:
   `for (const p of ['', '/questions', '/review']) fetch('/api/attempts/<id ของ C>' + p).then(r => console.log(p, r.status))`
   แล้วเปิด URL ไฟล์ PNG/PDF ของ C ที่จดไว้
5. ทำซ้ำข้อ 3–4 ตอนยังไม่ login

ผ่านเมื่อ: D และผู้ที่ไม่ login ไม่เห็นคะแนน ไฟ หรือไฟล์ใบของ C (ได้ 401/403/404 หรือข้อความ "ไม่มีสิทธิ์เข้าถึงข้อมูลผลสอบนี้") เก็บ screen recording ที่ไม่เห็นอีเมลจริง

---

## 4. AC-05 — QR Level H สแกนได้จริง

1. C ดาวน์โหลดเกียรติบัตร PNG และ PDF จาก Dashboard
2. พิมพ์ PDF ขนาดจริง (A4) 1 แผ่น และพิมพ์แบบย่อ 50% 1 แผ่น
3. แชร์ PNG ผ่าน LINE และ Facebook Messenger (ซึ่งบีบอัดภาพ) แล้วบันทึกภาพที่ได้รับกลับมา
4. สแกน QR ด้วยกล้องมือถือ 2 ระบบ (iOS, Android) จาก: กระดาษ A4, กระดาษย่อ, จอคอมที่เปิด PDF, ภาพที่ผ่าน LINE
5. ทุกครั้งต้องเปิด `https://<โดเมน>/cert/<public_id>` และขึ้นสถานะ Valid โดยไม่แสดงอีเมลหรือคะแนน
6. ในหน้า verify ลองกรอกชื่อผิด 1 ตัวอักษร → ต้องได้ "ไม่ตรง"

ผ่านเมื่อ: สแกนได้ทุกแหล่งทั้งสองระบบ บันทึกรูปถ่ายกระดาษ + screenshot ผล

---

## 5. AC-21 / AC-23 — บทความสาธารณะ, การแชร์ และการตั้งเวลาเผยแพร่

AC-21:

1. Admin สร้างบทความ Lesson ที่มี title, meta description และ OG image แล้วเผยแพร่
2. เปิด URL ตอนไม่ login ต้องอ่านได้
3. `curl -s https://<โดเมน>/articles/<slug> | grep -E 'og:title|og:image|canonical|application/ld\+json'` ต้องพบครบ
4. แชร์ลิงก์ใน LINE (แชทส่วนตัวกับตัวเอง) → preview ต้องแสดงภาพและชื่อที่ตั้งไว้ ถ้าเคยแชร์ URL นี้มาก่อน LINE อาจจำ preview เก่า ให้ใช้บทความใหม่
5. ทางเลือก: ตรวจด้วย Facebook Sharing Debugger และ Google Rich Results Test
6. เปลี่ยน slug แล้วเปิด URL เดิม ต้องได้ 301 ไป URL ใหม่ (`curl -sI`)

AC-23:

1. Author สร้าง draft → ส่งตรวจ, Admin approve แล้วตั้งเวลาเผยแพร่อีก 10 นาที
2. ก่อนถึงเวลา เปิด URL ตอนไม่ login ต้องไม่เห็น
3. หลังถึงเวลา (maintenance loop ทำงานทุก 30 วินาที) ต้องเห็นภายใน 1 นาที และหน้า admin มี revision เดียว

---

## 6. AC-25 — Popup แจ้งเตือนการตอบกลับคอมเมนต์

1. C คอมเมนต์ในบทความ
2. D login แล้วตอบกลับคอมเมนต์ของ C
3. C login (หรือ reload) ต้องเห็น popup 1 ครั้ง กดลิงก์แล้วไปที่ thread นั้น
4. C กดปิด popup → logout → login ใหม่ → **ต้องไม่ขึ้นซ้ำ** ทำซ้ำอีกรอบ (ตามข้อตรวจรับ "Login สองรอบ")
5. เปิดสองแท็บพร้อมกันก่อน dismiss แล้วปิดในแท็บหนึ่ง reload อีกแท็บ ต้องไม่ขึ้นซ้ำ
6. Dashboard ของ C ยังเห็นแจ้งเตือนนั้นในรายการย้อนหลัง

---

## 7. AC-39 — Restore / PITR drill บนโฮสต์จริง

### 7.1 Drill จากสคริปต์ (fixture บนเครื่องนี้)

```sh
cd /opt/pipoltutorapp
docker build -f docker/backend.Dockerfile -t pipol-backend-sow:local .
docker build -f docker/backup.Dockerfile  -t pipol-backup-sow:local .
cd backend/app
bun run test:restore
bun run test:pitr
```

สคริปต์สร้างฐานข้อมูล/container/volume ชื่อสุ่มแล้วลบเองหลังจบ ไม่แตะฐานข้อมูลแอป ผลเขียนทับ `manuals/restore-drill-result.json` และ `manuals/pitr-drill-result.json`

### 7.2 Drill จาก backup จริง (ตัวเลข RPO/RTO ที่ใช้ตรวจรับ)

1. จดเวลา T0 แล้วให้ C ส่งคำตอบ Daily 1 ข้อ (จดเวลา T1)
2. รอให้มี backup รายวันล่าสุดและ WAL ถูก archive (ดู `docker compose ... logs backups`)
3. คัดลอก bundle `.tar.gz.age` ล่าสุดไปเครื่องแยก (หรือดึงจากปลายทาง off-site) ตรวจ checksum
4. ถอดรหัสด้วย age identity ของ Owner บนเครื่องแยก
5. ทำตาม "กู้คืนจริง" ใน `operations-guide.md` ไปยัง **ฐานข้อมูลใหม่/PGDATA ใหม่** ตั้ง `recovery_target_time` = T1 + 1 นาที
6. จดเวลาเริ่ม–เสร็จ = **RTO จริง**; ตรวจว่าคำตอบที่ T1 อยู่ครบ และส่วนต่างระหว่าง target กับรายการล่าสุดที่กู้ได้ = **RPO จริง**
7. ตรวจหลังกู้: จำนวน users/attempts, เปิด verify ใบเก่าและใบใหม่ได้ Valid, ลายเซ็นผ่าน, ดาวน์โหลด PNG/PDF ได้, key history ครบ
8. ลบฐานที่กู้ทดลองหลังบันทึกผล ห้ามสลับ production ไปใช้ฐานนี้

ผ่านเมื่อ: กู้ DB + ไฟล์ใบ + keys ได้ครบ และมีตัวเลข RPO/RTO ที่ Owner ยอมรับ

---

## 8. AC-40 — 500 concurrent active users บนโฮสต์จริง

ทำ **ก่อนเปิดให้นักเรียนใช้งาน** หรือช่วงที่ไม่มีคนสอบ เพราะ load ใช้ CPU/DB ของเครื่องเดียวกัน

```sh
cd /opt/pipoltutorapp
docker build -f docker/backend.Dockerfile -t pipol-backend-sow:local .
cd backend/app
bun run test:load:docker
```

- สคริปต์สร้างฐานข้อมูลชื่อสุ่มใน PostgreSQL ของ compose (ต้องใช้ user ที่ `CREATE DATABASE` ได้ ซึ่งเป็นค่าตั้งต้นของ compose) สร้างผู้ใช้จำลอง 500 บัญชี ยิง 5,500 request แล้วลบฐานทิ้ง
- บน Linux สคริปต์ใช้ `--network host` เพื่อเข้าถึง PostgreSQL ที่ bind ไว้ที่ 127.0.0.1
- ผลเขียนที่ `manuals/load-500-result.json` เปรียบเทียบกับเกณฑ์ที่เสนอใน `load-test-notes.md` (p95 session ≤ 1 วิ, อ่านบทความ/อันดับ/ผลสอบ/ดาวน์โหลด ≤ 3 วิ, ค้นหา ≤ 3.5 วิ, Daily ≤ 2 วิ, ส่งข้อสอบ ≤ 6 วิ, import preview ≤ 4.5 วิ, error < 0.1%)
- ระหว่างรัน เก็บ `docker stats --no-stream` และ `uptime` ทุก 5 วินาทีไว้เป็นหลักฐานทรัพยากร

ข้อจำกัด: สคริปต์นี้ยิงจากในเครื่องเดียวกัน ไม่ผ่านอินเทอร์เน็ต, Caddy/HTTPS หรือ Google login ถ้า Owner ต้องการวัดผ่านเครือข่ายจริง ให้ตกลงเครื่องมือ (เช่น k6 จากเครื่องภายนอก) และระยะเวลาทดสอบต่อเนื่องเพิ่มเป็นงานแยก

ผ่านเมื่อ: 0 error, งานเกียรติบัตร 50 ใบเสร็จครบ และ p95 อยู่ในเกณฑ์ที่ Owner อนุมัติเป็น SLA

---

## 9. ตรวจซ้ำแบบไม่ทำลายข้อมูล (regression ระบบเดิม)

SoW 1.2 ต้องไม่ทำให้ระบบเดิมเสีย หลัง deploy ให้ทดสอบด้วยมือ:

- [ ] Login Google, แก้โปรไฟล์ (ชื่อ, ชื่อเล่น, โรงเรียนเป้าหมาย)
- [ ] เปิดคลังข้อสอบ, เริ่ม → autosave → ปิดแท็บแล้วกลับมาทำต่อ → ส่ง → ดูผล
- [ ] Admin: question bank, pack, ผลสอบ/CSV, regrade
- [ ] ชำระเงิน Omise ด้วย **test key** (ถ้ายังไม่มี live key) และหน้า ดูดวง
- [ ] เมนูบนมือถือ (393 px) ครบ 7 รายการ ไม่ล้นจอ, ไฟข้างชื่อบัญชี, dropdown 6 รายการ

---

## 10. หลังทดสอบ

1. ลบหรือ anonymise บัญชีทดสอบ C/D ผ่านเมนูลบบัญชี (เลือก revoke เกียรติบัตร) ถ้าไม่ต้องการเก็บไว้
2. ลบบทความ/คอมเมนต์ทดสอบ หรือ archive
3. ไม่ commit `docker/.env`, ไฟล์ backup, age identity หรือรูปที่เห็นอีเมลจริง
4. อัปเดต `acceptance-matrix.md`: เปลี่ยนเฉพาะข้อที่มีหลักฐานเป็น "PASS (production)" พร้อมวันที่ ผู้ทดสอบ และชื่อไฟล์หลักฐาน
5. Owner ลงนาม UAT checklist (SoW 12.2 Milestone 3)

---

## บันทึกผล

| ข้อ | วันที่/เวลา | ผู้ทดสอบ | ผล (PASS/FAIL) | หลักฐาน (ชื่อไฟล์/ลิงก์) | หมายเหตุ |
|---|---|---|---|---|---|
| Deploy + smoke (1.3) | 2026-11-15 00:47 | Claude Code บน server | PASS | log ใน session | deploy 6fdc709 → 1025874, backup `/opt/backups/db-20261115-003845.dump`; ยังไม่มีบทความเผยแพร่และยังไม่ออกใบ จึงยังไม่มี PEM |
| Owner สำรอง + last-Owner guard (2) | | | | | |
| Retention อนุมัติ version | | | | | |
| Backup off-site ตั้งแล้ว | | | | | ปลายทาง: |
| AC-01 | 2026-11-15 00:49 | Claude Code บน server | ยังไม่ครบ | log ใน session | ส่วนไม่ login ผ่าน: `/api/attempts/<id>` (+`/questions`, `/review`) = 401, หน้าผลสอบ redirect ไป login; ยังต้องทดสอบด้วยบัญชี C/D |
| AC-05 | | | | | iOS / Android |
| AC-21 | | | | | |
| AC-23 (โฮสต์จริง) | | | | | |
| AC-25 | | | | | |
| AC-39 สคริปต์ (7.1) | 2026-11-15 00:48–00:53 | Claude Code บน server | PASS | `restore-drill-result.json`, `pitr-drill-result.json` | restore RTO 0.83 วิ, PITR RTO 2.5 วิ (fixture); `test:pitr` ล้มบน Linux จน `ready()` เปลี่ยนไปตรวจผ่าน TCP |
| AC-39 backup จริง (7.2) | | | | | RPO = ____ RTO = ____ |
| AC-40 | | | | | p95 รวม = ____ error = ____ |
| Regression ระบบเดิม (9) | | | | | |
