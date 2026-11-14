# ใบตอบข้อกำหนดของผู้พัฒนา — SoW 2026 (ข้อ 12.4, 13, 15.3)

จัดทำ 14 พ.ย. 2026 ปรับปรุง 20:20 น. (UTC+7) อ้างอิง `pipoltutor_scope_of_work_2026.pdf` v1.0 ใช้คู่กับ `acceptance-matrix.md` (ผลรายข้อ AC-01–40) เอกสารนี้ตอบแบบฟอร์มข้อ 12.4 ทีละ Requirement ID ตามที่ข้อ 1.3 กำหนด

**คำที่ใช้ในช่องสถานะ** — Included: ทำแล้วในขอบเขต · Partially Included: ทำบางส่วน มีข้อจำกัดตามที่ระบุ · Additional Cost / Not Feasible: ไม่มีรายการใดอยู่ในสองสถานะนี้

**ที่มาของหลักฐาน**

- `S1`–`S27` = `backend/app/scripts/sow.integration.ts`, `C1`–`C14` = `certificates.integration.ts`, `D1`–`D8` = `delivery.integration.ts`, `A1`–`A8` = `activity.integration.ts` ทุกชุดรันกับ API จริงบนฐานข้อมูลชั่วคราว รันซ้ำล่าสุด 14 พ.ย. 2026 เวลา 20:17 น. ผ่านครบ 27, 14, 8 และ 8 กลุ่ม (`sow-`, `certificate-`, `delivery-`, `activity-test-result.json`) รายชื่อกลุ่มอยู่ใน `acceptance-matrix.md`
- `R` = `restore-drill-result.json`, `pitr-drill-result.json` · `L` = `load-500-result.json`, `load-test-notes.md`
- "โค้ด" = อ่านจาก source แล้วพบการทำงานตามข้อกำหนด แต่ไม่มีการทดสอบอัตโนมัติเฉพาะข้อ · "หน้าจอ" = เปิดใช้งานจริงในเบราว์เซอร์กับข้อมูลจำลอง
- ทุกข้อเป็นผลบนเครื่องพัฒนาและข้อมูลจำลอง ยังไม่ใช่การตรวจรับบน production ดูหัวข้อ "สิ่งที่ยังต้องยืนยันบนระบบจริง"

## M1 — Certificate

| ID | สถานะ | ข้อจำกัด / ทางเลือก | หลักฐาน |
|---|---|---|---|
| CERT-01 | Included | ตั้งรายชุด: เปิด/ปิด, Auto-submit, Hard cutoff, Reopen, ระดับชั้น, วิชา, Template ไม่ออกใบให้ Attempt ที่ยังไม่สิ้นสุด | C5, C13 (AC-10) |
| CERT-02 | Included | หนึ่งใบ Active ต่อ Attempt บังคับด้วย unique index; กดซ้ำไม่ออกซ้ำ | C6, C12 |
| CERT-03 | Included | Dashboard แสดงใบค่าเริ่มต้น (คะแนนดีที่สุด) และเปิดใบของครั้งอื่นได้จากหน้ารายละเอียด | C12 (AC-07), หน้าจอ |
| CERT-04 | Included | Template ตั้งต้นไม่มีคะแนน/อันดับ; Admin เพิ่ม Dynamic Field ได้ | C3, C4, โค้ด |
| CERT-05 | Included | เปลี่ยนชื่อแล้วถอนใบเดิม ออก revision ใหม่พร้อม public ID ใหม่ และแจ้งเตือนในเว็บ | C10 (AC-06) |
| CERT-06 | Included | PNG 3000×2121 และ PDF A4 สร้างฝั่ง server; โหลดซ้ำได้ไฟล์เดิม | C4, C9 |
| CERT-07 | Included | คิวใน PostgreSQL (`SKIP LOCKED`) retry/backoff สูงสุด 8 ครั้ง แล้วให้ Admin กด retry | C6 (AC-08) |
| 3.2 Editor | Included | พื้นหลัง crop/zoom, ข้อความ/รูป/ลายเซ็น, ลากวาง, Font Mitr/Anuphan, Dynamic Fields, Draft/Publish, Versioning, Preview PNG/PDF การลากวางในเบราว์เซอร์ยังไม่มีบันทึกการทดสอบด้วยมือครบทุกองค์ประกอบ | C3, C4 |
| CERT-08 | Included | public ID สุ่ม, QR Level H, URL `/cert/{public_id}` ไม่มีข้อมูลลับ ถอด QR ด้วยโปรแกรมจาก PNG เต็ม/ย่อ 50% และ PDF 144/72 dpi ได้ **การสแกนด้วยกล้องจากสิ่งพิมพ์จริงเป็นงานตรวจบนระบบจริง** | C7, C8 (AC-05) |
| CERT-09 | Included | หน้า Verify สาธารณะ มีปุ่มตรวจชื่อและ "ดูผลสอบของฉัน"; ผู้ใช้อื่นได้ 404/ข้อความไม่มีสิทธิ์ | S5, C9 |
| CERT-10 | Included | ตอบเพียงตรง/ไม่ตรง; จำกัด 8 ครั้งต่อนาทีต่อผู้ใช้ต่อใบ นับในฐานข้อมูลจึงใช้ได้ข้าม process | C8 (AC-03), โค้ด |
| CERT-11 | Included | Valid / Revoked / Previous valid / Superseded / Not found; เหตุผลรายบุคคลเห็นเฉพาะ Admin | C9, C10, C11 |
| CERT-12 | Included | RSA-PSS/SHA-256 ลงนาม canonical manifest ฝั่ง server | C9 (AC-04) |
| CERT-13 | Included | คู่มือระบุชัดว่าไม่ได้พิสูจน์ไฟล์ PNG/PDF ระดับพิกเซล บริการตรวจ hash ไฟล์อัปโหลดเป็น Optional | `user-admin-guide.md` |
| CERT-14 | Included | Private key เป็นไฟล์ PEM บน volume ของ server ที่ Owner ควบคุม ไม่ได้ใช้ KMS ภายนอก; หมุน key แล้วใบเก่ายังตรวจผ่าน; เฉพาะ Owner จัดการ key | C9, S4 |
| CERT-15 | Included | เลือกคงใบหรือถอนใบก่อนลบบัญชี บันทึก consent และทำข้อมูลนิรนาม | C14, S26 |

## M2 — Ranking & Statistics

| ID | สถานะ | ข้อจำกัด / ทางเลือก | หลักฐาน |
|---|---|---|---|
| STAT-01 | Included | x/N รวมทุกบัญชี ผู้ถูกคัดจากฐานสถิติยังมีอันดับ | S3 (AC-15) |
| STAT-02 | Included | Mean / Population SD / Z / Percentile จากกลุ่มอ้างอิงที่อนุมัติ | S3 |
| STAT-03 | Included | ค่าเริ่มต้นใช้ Attempt คะแนนสูงสุด ตั้ง policy รายชุดได้ | S2 (AC-12) |
| STAT-04 | Included | Score → เวลาที่รับรอง → เวลาเริ่ม; เท่ากันทุกเงื่อนไขได้อันดับร่วม 1,1,3 | S1 (AC-11) |
| STAT-05 | Included | เวลาออนไลน์สะสมจาก checkpoint ที่ server รับ เบราว์เซอร์เก็บบันทึกเวลาทำงาน (รวมช่วง offline) เป็นลำดับต่อเนื่องและส่งตามเมื่อกลับมาออนไลน์ server ตรวจขอบเขตไม่ให้เกินเวลาสิ้นสุดที่ server บันทึก เวลา offline หรือหลายแท็บไม่ถูกบวกเข้าเวลาที่ใช้เรียงอันดับเอง แต่ติดธงให้ Admin ตรวจหลักฐานแล้วรับรองผ่าน preview พร้อม audit เวลาที่รับรองใช้ใน tie-break จริง ไม่ใช้ wall-clock แทน ข้อจำกัด: เวลา offline เป็นหลักฐานจากเบราว์เซอร์ จึงต้องให้คนรับรองเสมอ | S1, A1–A8, หน้าจอ (`activity-review-*.png`) |
| STAT-06 | Included | ธงไม่ตัดใครออกเอง ต้องผ่าน preview และ Admin ยืนยัน | S7 (AC-13) |
| STAT-07 | Included | กรอง/เลือกหลายรายการ/preview/commit พร้อม audit คัดออก 100 รายการในคำสั่งเดียวผ่าน API ที่หน้าจอใช้ | S7, D7 |
| STAT-08 | Included | ผู้ส่งคนแรกเห็น 1/1 พร้อมข้อความผลเบื้องต้น | S5 |
| STAT-09 | Included | ค่าที่ไม่ override คำนวณใหม่และสร้าง revision; ค่า override คงเดิมพร้อมธงทบทวน | S6 (AC-17, AC-18) |
| STAT-10 | Included | เก็บ Calculated และ Official แยกกัน ผู้เรียนเห็นเฉพาะ Official ที่เผยแพร่ | S6, S10 |
| STAT-11 | Included | ทุก publish/override สร้าง revision; rollback ไม่ลบประวัติ | S9 (AC-20) |
| STAT-12 | Included | CSV/XLSX ตาม template คงที่ มี preview diff และ validation เข้มงวด แถวซ้ำทำให้ปฏิเสธทั้งไฟล์ | S8 (AC-19) |
| STAT-13 | Included | การนำเข้าไม่แตะคำตอบดิบ | S6 |
| STAT-14 | Included | ไม่มี Public Leaderboard; เปลี่ยน attempt id แล้วได้ 404 | S5, S10 |

## M3 — Article CMS

| ID | สถานะ | ข้อจำกัด / ทางเลือก | หลักฐาน |
|---|---|---|---|
| CMS-01 | Included | Lesson/News หลายระดับชั้นและหลายวิชาบน URL เดียว | S11 |
| CMS-02 | Included | CRUD หมวด, หมวดแม่, เรียงลำดับ, รวมหมวดผ่าน preview ปฏิเสธการวนหมวด URL หมวดเดิมยังใช้ได้ผ่าน alias | D1, หน้าจอ (`cms-reason-confirm.png`) |
| CMS-03 | Included | อ่านได้โดยไม่ login, slug redirect, Title/Meta/OG/JSON-LD ฝั่ง server ยังไม่ได้ตรวจ preview ใน LINE จริง | S11 (AC-21) |
| CMS-04 | Included | ค้นหาไทย คำพ้องจาก Admin พิมพ์ผิดใกล้เคียง คำแนะนำ และคำค้นยอดนิยม ค้นจากบทความไม่เกิน 5,000 รายการต่อครั้ง ถ้าเนื้อหามากกว่านั้นต้องตัดสินใจเรื่อง search index | S11 |
| CMS-05 | Included | Source URL, เครดิต, deadline/สถานะหมดเขต ยังอ่านย้อนหลังได้ ไม่มี RSS/Scraping | โค้ด |
| 5.2 Editor/Media/Home | Included | Block editor ตามรายการในข้อ 5.2, ตาราง merge, LaTeX, media library, แนบ PDF/Office, embed YouTube/TikTok ตาม allowlist, preview desktop/mobile, workflow, ตั้งเวลาเผยแพร่และ revision เนื้อหาเป็น structured block ไม่รับ raw HTML ยังไม่ได้ทดสอบทุก block บนทุกเบราว์เซอร์ด้วยมือ | S11, S24, S27, D2, D3 (AC-22, AC-23) |
| CMS-06 | Included | คอมเมนต์ทั่วไปขึ้นทันที คำเสี่ยงถูกซ่อนรอตรวจ | S12 (AC-24) |
| CMS-07 | Included | Popup หนึ่งครั้งต่อ notification; ปิดแล้วไม่ขึ้นซ้ำ และยังดูย้อนหลังได้ในรายการแจ้งเตือนที่ Dashboard | S12, D4, หน้าจอ |
| CMS-08 | Included | นับ view/click เข้า-ออก/แหล่งที่มา ตัดซ้ำรายผู้ชมต่อวัน เก็บเฉพาะ hostname ของ referrer; ตั้งรายบทความว่าแสดงยอดอ่าน/ป้ายยอดนิยม/ไม่แสดง | D2, โค้ด |
| CMS-09 | Included | Canonical/OG/structured data, sitemap, 301/404/410 ไม่รับประกันอันดับ Google | โค้ด |

## M4 — Daily Challenge & Fire

| ID | สถานะ | ข้อจำกัด / ทางเลือก | หลักฐาน |
|---|---|---|---|
| FIRE-01 | Included | ชุดเดียวต่อวันสำหรับทุกระดับชั้น ใช้วันของ Asia/Bangkok | S18, โค้ด |
| FIRE-02 | Included | สองครั้งต่อข้อ ตรวจที่ server; ครั้งที่สามถูกปฏิเสธ | S13 (AC-26) |
| FIRE-03 | Included | ตอบครบทุกข้อแต่ยังผิด = รักษา; ข้อเดียวผิดครั้งเดียวแล้วออก = ไม่รักษา | S13, S17 (AC-27, AC-28) |
| FIRE-04 | Included | รักษาแล้วทำถูกครบในวันเดียวกันเปลี่ยนเป็นเพิ่ม +1; ส่งซ้ำ 100 ครั้งเพิ่มครั้งเดียว | S14 (AC-30), โค้ด |
| FIRE-05 | Included | หลังเที่ยงคืนส่งของวันเก่าไม่ได้ | S15 (AC-31) |
| FIRE-06 | Included | หมดวันแล้วคัดลอกโจทย์เข้าคลังด้วย Question ID ใหม่ แก้ในคลังไม่กระทบ Daily เดิม หน้าโจทย์ย้อนหลังฝึกซ้ำได้ไม่จำกัด มีปุ่มสุ่มวัน และแสดงเฉลยหลังส่งคำตอบฝึก ไม่มีผลกับไฟ | S15, หน้าจอ |
| FIRE-07 | Included | คำใบ้เปิดรายข้อ; เฉลยเปิดเมื่อจบสิทธิ์หรือวันถัดไปตามที่ตั้ง API ไม่ส่งเฉลยก่อนเวลา | S13, โค้ด |
| FIRE-08 | Included | กู้ได้ถึง 23:59:59 ของวันถัดไป | S16 (AC-32) |
| FIRE-09 | Included | แสดง Current เดิมพร้อมป้ายรอกู้ไฟและปุ่มกู้ | S16, หน้าจอ |
| FIRE-10 | Included | เพดาน 3/4/5/6 ตาม Current; คงเหลือไม่ติดลบ | S16 (AC-33) |
| FIRE-11 | Included | Highest ไม่หายเมื่อ Current เป็น 0 | S16 (AC-34) |
| FIRE-12 | Included | Protect / Compensate / Bulk Recover / Extend พร้อมช่วงเวลา กลุ่มผู้เรียน เหตุผล preview และ audit; วันไม่มีโจทย์ auto-protect Extend เลื่อนเวลาปิดรับโจทย์ของวันนี้ได้ไม่เกิน 24 ชั่วโมงสำหรับทุกคนหรือกลุ่มที่เลือก ระหว่างนั้นไม่เปิดเฉลยและไม่คัดลอกเข้าคลัง ข้อจำกัด: ต้องสั่งก่อนเที่ยงคืนของวันนั้น เพราะหลังเที่ยงคืนเฉลยถูกเปิดแล้ว กรณีนั้นใช้ Protect/Compensate | S18, S22, S23 |
| FIRE-13 | Included | Regrade มี preview ผลกระทบ เลือกคง Current เดิมได้ เก็บประวัติผลตรวจ | S20 (AC-36) |
| 6.4 Admin/Import/Analytics | Included | CRUD/คัดลอก/กำหนดวัน/คิวสำรอง, นำเข้า CSV/XLSX, สรุปรายวัน รายข้อ อัตราสำเร็จ จำนวนคำใบ้ที่เปิด และหัวข้อที่ตอบผิดบ่อย, Fire Ledger และประวัติการกู้ Flexible mapping และ ZIP รูปเป็น Optional | S18, S21, D5 (AC-35, AC-37), หน้าจอ |

## ส่วนร่วม (หัวข้อ 2, 7–11)

| หัวข้อ | สถานะ | ข้อจำกัด / ทางเลือก | หลักฐาน |
|---|---|---|---|
| 2.1 Navigation | Included | เมนู 7 รายการ มือถือพับเป็นเมนูเดียว แสดงไฟข้างชื่อบัญชี และ dropdown ครบ 6 รายการ | หน้าจอ |
| 2.2–2.3 Public/Logged-in และตัวระบุผู้ใช้ | Included | สิทธิ์ผูกกับ Google subject ที่ server ไม่เชื่ออีเมลหรือ ID จาก client ยังไม่ได้ทดสอบด้วยบัญชี Google จริงสองบัญชี | S5, C9 (AC-01) |
| 7.1 Student Dashboard | Included | การ์ดไฟพร้อมสถานะโจทย์วันนี้, ประวัติสอบพร้อมระดับชั้น วิชา รหัสการส่ง อันดับ และป้ายเบื้องต้น/รับรอง, เกียรติบัตร, รายการแจ้งเตือน | D4, หน้าจอ, โค้ด |
| 7.2 ข้อความ UX | Included | ใช้ข้อความตามตารางหรือรักษาความหมาย | โค้ด |
| 8.1 Admin Pages | Included | Overview แสดงคิวเกียรติบัตร บทความร่าง ความคิดเห็นรอตรวจ ธงอันดับรอตัดสิน และสถานะไฟของวันนี้ | D6, หน้าจอ |
| 8.2 Permission | Included | Role template 5 แบบ + สิทธิ์ราย module; ถอนสิทธิ์มีผลกับ request ถัดไป; Owner เท่านั้นจัดการสิทธิ์และ key | S4, S25 (AC-38) |
| 8.3 Audit | Included | actor, action, module, target, before/after, reason, revision, request, source | โค้ด, หน้าจอ (`audit-actor-confirm.png`) |
| 9 Data Model / Contracts | Included | `api-contract.json` ส่งออก request schema ของทุก route ไม่ใช่ OpenAPI ฉบับสมบูรณ์; รูปแบบ response อธิบายใน `api-contract.md` | `api-contract.*` |
| 10.1 Security | Included | ตรวจ ownership ทุก object, ตรวจ Origin ของคำขอเขียน, จำกัด URL/embed, ตรวจ MIME และขนาดไฟล์, กัน CSV formula ไม่ใช่ penetration test โดยบุคคลที่สาม | S5, S10, S24, D3, A3 |
| 10.2 Privacy/Retention | Included | Owner ตั้งและอนุมัติจำนวนวันเก็บรายประเภท ค่าเสนอ: technical logs 30 วัน ประเภทอื่น 365 วัน เมื่ออนุมัติแล้วระบบลบ technical logs และ learning events (ยอดเข้าชมบทความ) ที่เกินกำหนดอัตโนมัติพร้อม audit ข้อจำกัด: หมวดที่มีข้อมูลเชื่อมโยง (โปรไฟล์ ผลสอบ revision เกียรติบัตร ความคิดเห็น audit) ระบบบันทึกนโยบายไว้ แต่ไม่ลบเอง ต้องดำเนินการตามแผน lifecycle ที่ Owner อนุมัติ การลบบัญชีรายคนทำงานทันทีพร้อม consent | D8, S26, C14, `operations-guide.md` |
| 10.3 Backup/PITR | Included (ทดสอบบนเครื่องพัฒนา) | สำรองรายวันแบบเข้ารหัส + WAL archive มี restore drill ทั้ง DB key และไฟล์ ปลายทาง off-site ยังไม่ได้ตั้ง | R (AC-39) |
| 11.1 Load | Included (ทดสอบบนเครื่องพัฒนา) | 500 ผู้ใช้พร้อมกัน 5,500 คำขอ ไม่มี error บน Docker/Linux ยังไม่ได้ทดสอบบนโฮสต์จริง | L (AC-40) |

## รายการข้อ 13 — ไม่รวมในเวอร์ชันแรก

ไม่ได้พัฒนาทั้งหมดตามที่ SoW กำหนด: Full Page Builder, Home Freeform Builder, AI Search, RSS/Crawling, โฮสต์วิดีโอเอง, Flexible CSV mapping + ZIP, Qualified PKI PDF Signature, ตรวจไฟล์ด้วย File Hash, Public Leaderboard, Email/SMS, Stress Test 750, ABAC ราย record, Social Posting อัตโนมัติ, ตรวจทุจริตด้วย ML หากต้องการรายการใดให้เสนอเป็น Change Request แยกราคา

## คำยืนยันตามข้อ 15.3

| ประเด็น | คำตอบ |
|---|---|
| Technology Stack | Backend: Bun + ElysiaJS + Drizzle ORM บน PostgreSQL 16 · เว็บผู้เรียน: Next.js 16 + React 19 + Tailwind v4 · Admin: Next.js static export ที่ `/admin/` · Caddy เป็น reverse proxy/HTTPS · Docker Compose ต่อยอดจากระบบสอบเดิม ไม่ได้เปลี่ยน stack |
| Data migration | Drizzle migration 0017–0024 เพิ่มตารางและคอลัมน์ ไม่มีคำสั่งลบตารางหรือคอลัมน์ และไม่แก้ข้อมูล Attempt เดิม มี backfill รายการเดียวใน 0019: ตั้ง `workflow` และ `published_snapshot` ให้บทความที่เผยแพร่อยู่แล้ว |
| QR / Signature / Key storage | QR Level H (`qrcode`), RSA-PSS/SHA-256, private key เป็น PEM บน volume `cert_keys_data` ไม่อยู่ใน image หรือ frontend เก็บ public key เก่าไว้ตรวจใบเดิม |
| Font licenses | Mitr และ Anuphan ภายใต้ SIL Open Font License แนบไฟล์ license ใน `backend/app/assets/fonts/` ไม่มีการอัปโหลด font เอง |
| Backup / PITR / RPO / RTO | Logical dump + physical base backup + WAL (`archive_timeout=60s`) เข้ารหัสด้วย age ค่าที่วัดได้เป็นของ fixture เท่านั้น (restore 0.4–2.2 วินาทีบนข้อมูลจำลอง) **ยังไม่มีตัวเลข RPO/RTO ของระบบจริง** ต้องวัดบนโฮสต์และขนาดข้อมูลจริงหลัง Owner เลือกปลายทาง off-site |
| API compatibility | Route เดิมของระบบสอบยังอยู่ครบ ส่วนใหม่เพิ่ม route และ field ผลสอบของผู้เรียนเปลี่ยนไปแสดงค่า Official ที่เผยแพร่ |
| Deployment environments | Docker Compose เดียวกับระบบเดิม เพิ่ม volume `certificates_data`, `cert_keys_data` และ overlay `docker-compose.backup.yml` ยังไม่ได้ deploy |
| Performance SLA (ข้อเสนอ ยังไม่อนุมัติ) | p95: session ≤ 1 วิ · อ่านบทความ/อันดับ/ผลสอบ/ดาวน์โหลดใบ ≤ 3 วิ · ค้นหา ≤ 3.5 วิ · ส่ง Daily ≤ 2 วิ · ส่งข้อสอบ ≤ 6 วิ · Import preview ≤ 4.5 วิ · error < 0.1% ที่มาและข้อจำกัดอยู่ใน `load-test-notes.md` |
| Retention default | Technical logs 30 วัน ประเภทอื่น 365 วัน รอ Owner อนุมัติ |
| ค่าใช้จ่าย hosting/storage, จำนวนรอบแก้ UI, ค่าดูแลรายเดือน | **ยังไม่ได้กำหนด** เป็นข้อตกลงทางการค้าที่ผู้พัฒนาต้องกรอกเองในตารางด้านล่าง |

## ตารางราคา (ข้อ 12.1) — รอผู้พัฒนากรอก

เอกสารนี้ไม่ใส่ตัวเลขราคาหรือจำนวนวันให้ เพราะเป็นข้อเสนอทางการค้าของผู้พัฒนา

| หมวด | ราคาเริ่มต้น (THB) | วันทำงาน/ส่งมอบ | สิ่งที่รวม/ไม่รวม |
|---|---|---|---|
| M1 Certificate + Verification | | | ดูตาราง M1 |
| M2 Ranking & Statistics | | | ดูตาราง M2 |
| M3 Article CMS | | | ดูตาราง M3 |
| M4 Daily Challenge/Fire | | | ดูตาราง M4 |
| Shared Modules / Integration | | | สิทธิ์, audit, dashboard, backup, queue |
| Hosting/DB/Storage/Backup (รายเดือน) | | | ต้องเลือกโฮสต์และปลายทาง off-site ก่อน |
| Optional Features | | | รายการข้อ 13 |

## สิ่งที่ยังต้องยืนยันบนระบบจริง

1. Login ด้วยบัญชี Google จริงสองบัญชีและทดสอบ AC-01 ซ้ำ
2. สแกน QR ด้วยกล้องจาก PDF ที่พิมพ์และภาพที่แชร์ผ่านแอป (AC-05)
3. Preview ลิงก์บทความใน LINE (AC-21) และการเผยแพร่ตามเวลาที่ตั้งบนโฮสต์จริง (AC-23)
4. Load test 500 ผู้ใช้และ restore/PITR drill บนโฮสต์ที่เลือก พร้อมตัวเลข RPO/RTO จริง (AC-39, AC-40)
5. Owner อนุมัติ retention, ปลายทางสำรอง off-site, age identity และบัญชี Owner สำรอง

## งานค้าง ณ เวลาจัดทำเอกสาร

- ไม่มีงานค้างในโค้ดตามขอบเขต SoW รายการที่ยังต้องทำเป็นการตรวจบนระบบจริงและการตัดสินใจของ Owner ตามหัวข้อก่อนหน้า
- ราคา จำนวนวันทำงาน ค่า hosting รายเดือน และเงื่อนไขรับประกัน (ข้อ 12.1–12.3) ผู้พัฒนาต้องกรอกเอง
- ยังไม่มี commit, push หรือ deploy ผู้ใช้เป็นผู้ commit
