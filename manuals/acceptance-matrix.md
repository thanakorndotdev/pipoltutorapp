# ตรวจรับ SoW 2026 — Test Case Sheet และหลักฐาน ณ 2026-11-14 20:20 น. (UTC+7)

เอกสารนี้คือ Test Case Sheet ตามข้อ 11.2–11.3 ของ `pipoltutor_scope_of_work_2026.pdf` (หน้า 17–19) ใช้คู่กับ `sow-requirement-response.md` ซึ่งตอบรายข้อตามแบบฟอร์มข้อ 12.4

**ความหมายของสถานะ**

- **PASS (local)** — สคริปต์ทดสอบอัตโนมัติหรือการตรวจหน้าจอที่ระบุผ่าน บนเครื่องพัฒนา ฐานข้อมูลชั่วคราว และบัญชี/เนื้อหาจำลอง
- **PASS (local) + ตรวจบนระบบจริง** — ส่วนที่ทำในโค้ดผ่านครบ แต่ข้อตรวจรับนี้ต้องใช้สิ่งที่มีเฉพาะบนระบบจริง (บัญชี Google จริง กล้อง LINE โฮสต์จริง) จึงยังต้องมีคนตรวจอีกครั้งหลัง deploy
- ไม่มีข้อใดเป็น FAIL ในรอบนี้ ไม่มีข้อใดถูกเปลี่ยนเป็น production PASS โดยไม่มีหลักฐาน

## แหล่งหลักฐาน

ทุกชุดรันกับ API ที่ mount จริงและ PostgreSQL จริงบนฐานข้อมูลสุ่มชื่อที่สร้างและลบในรอบนั้น ไม่ mock ธุรกรรม รันซ้ำล่าสุด 14 พ.ย. 2026 เวลา 20:17 น. ผ่านครบทุกกลุ่ม

| รหัส | ไฟล์ผล | สคริปต์ (ใน `backend/app`) | ผล |
|---|---|---|---|
| S1–S27 | `sow-test-result.json` | `bun run test:sow` → `scripts/sow.integration.ts` | 27/27 |
| C1–C14 | `certificate-test-result.json`, `pdf-qr-result.json` | `bun run test:certificates` | 14/14 |
| D1–D8 | `delivery-test-result.json` | `bun run test:delivery` | 8/8 |
| A1–A8 | `activity-test-result.json` | `bun run test:activity` | 8/8 |
| R | `restore-drill-result.json`, `pitr-drill-result.json` | `bun run test:restore`, `bun run test:pitr` | ผ่าน (fixture) |
| L | `load-500-result.json`, `load-test-notes.md` | `bun run test:load:docker` | 5,500 requests, 0 errors |
| UI | `screenshots/`, `ui-review.md` | Chrome desktop + iPhone 16 (393×852) | ผ่าน |

นอกจากนี้ TypeScript ของ backend และ frontend ทั้งสอง, ESLint ของไฟล์ที่เปลี่ยน, และ `next build --webpack` ของทั้งสองแอปผ่านในรอบเดียวกัน

## ผลรายข้อ AC-01–40

| ID | สถานการณ์ | สถานะ | หลักฐาน / ข้อจำกัด |
|---|---|---|---|
| AC-01 | บัญชี A/B เปลี่ยน Attempt ID | PASS (local) + ตรวจบนระบบจริง | S5, S10, C9: บัญชี B ได้ 404 ทั้งอันดับ ผลสอบ และไฟล์ใบของ A ตัวตนผูกกับ session ฝั่ง server ไม่เชื่อ ID จาก client ต้องทดสอบซ้ำด้วยบัญชี Google จริงสองบัญชีหลังตั้ง OAuth production |
| AC-02 | Public verify | PASS (local) | C9: ไม่ login ตรวจได้ Valid/Revoked/Not found โดยไม่เห็นชื่อ อีเมล หรือคะแนน |
| AC-03 | ชื่อใน PNG ถูกแก้ | PASS (local) | C8: ส่งชื่อปลอมกับ public ID เดิม ได้ `match=false` |
| AC-04 | Manifest ถูกดัดแปลง | PASS (local) | C9: แก้หนึ่ง field แล้ว signature ไม่ผ่าน; หมุน key แล้วใบเก่ายังตรวจผ่าน |
| AC-05 | QR Level H | PASS (local) + ตรวจบนระบบจริง | C7, C8: ถอด QR จาก PNG ต้นฉบับ, ภาพย่อ 50%, และ PDF ที่ rasterize จริงที่ 144 และ 72 dpi สำเร็จ (`pdf-qr-result.json`) ยังต้องสแกนด้วยกล้องโทรศัพท์จากกระดาษที่พิมพ์และจากภาพที่แชร์ผ่านแอปจริง |
| AC-06 | เปลี่ยนชื่อโปรไฟล์ | PASS (local) | C10: ใบเดิมถูกถอน ออก revision ใหม่พร้อม public ID ใหม่ และสร้างแจ้งเตือน |
| AC-07 | หลาย Attempt | PASS (local) | C12: สองรายการแยกกัน ค่าเริ่มต้นเป็นคะแนนสูงสุด |
| AC-08 | Render queue | PASS (local) | C6: render ล้มครั้งแรก retry งานเดิมสำเร็จ กดพร้อมกันไม่ออกซ้ำ |
| AC-09 | เปลี่ยน Template ย้อนหลัง | PASS (local) | C11: นโยบาย previous_valid และ superseded |
| AC-10 | Auto-submit eligibility | PASS (local) | C13 |
| AC-11 | Ranking tie | PASS (local) | S1: 85 เท่ากันเรียงตาม active time แล้วเวลาเริ่ม; เท่ากันทุกเงื่อนไขได้ 1, 1, 3 |
| AC-12 | Selected attempt | PASS (local) | S2 |
| AC-13 | Statistical exclusion | PASS (local) | S7: ธงไม่เปลี่ยน Mean; preview ไม่เปลี่ยนฐาน; commit แล้ว N_ref เปลี่ยน; D7: เลือก 100 รายการพร้อมกันผ่าน preview → commit ครั้งเดียวพร้อม audit |
| AC-14 | Percentile tie | PASS (local) | S2: reference [30, 40, 40, 50] ผู้ได้ 40 ได้ 50.00 ทั้งคู่ |
| AC-15 | Rank vs reference | PASS (local) | S3: N_rank 20 / N_ref 18; คะแนนของคนที่ถูกคัดออกไม่กระทบฐาน |
| AC-16 | Zero SD | PASS (local) | S3: SD=0 ให้ Z=0.00 พร้อมหมายเหตุ; N_ref=0 ให้ N/A |
| AC-17 | Official override freeze | PASS (local) | S6: 96.50 คงเดิมเมื่อมีผู้สอบเพิ่ม และขึ้นธงรอทบทวน |
| AC-18 | Auto final non-override | PASS (local) | S6: ค่าที่ไม่ override อัปเดตพร้อม revision; คำตอบดิบไม่เปลี่ยน |
| AC-19 | Import validation | PASS (local) | S8: แถวซ้ำทำให้ปฏิเสธทั้งไฟล์; ID/ชนิด/ช่วงค่าตรวจที่ API |
| AC-20 | Rollback | PASS (local) | S9: rollback เป็น revision ใหม่ที่อ้างอิงรุ่นเดิม ประวัติไม่หาย |
| AC-21 | Public article and share | PASS (local) + ตรวจบนระบบจริง | S11 + UI: anonymous อ่านได้, title/OG/canonical/JSON-LD render ฝั่ง server ต้องลองแชร์ลิงก์ใน LINE หลัง deploy บนโดเมนจริง |
| AC-22 | Editor ไทย/คณิต | PASS (local) | S11 + UI: ตาราง merge, LaTeX, ภาษาไทยบน 393 px; D3: แนบ PDF/Office และปฏิเสธ MIME ปลอม/PDF มี script/macro; S24: URL/embed ไม่ปลอดภัยถูกปฏิเสธ ไม่ได้ทดสอบด้วยมือครบทุก block บนทุก browser |
| AC-23 | CMS scheduling | PASS (local) | S11: schedule ก่อน approve ถูกปฏิเสธ; S27: ตัวเผยแพร่ตามเวลาเปิดบทความที่ approve แล้วตรงเวลาที่ถึงกำหนด worker พร้อมกันสร้าง revision เดียว |
| AC-24 | Comment spam | PASS (local) | S12: ข้อความเสี่ยงซ่อนจน approve; reject/hide/delete มี audit |
| AC-25 | Reply notification | PASS (local) + ตรวจบนระบบจริง | S12, D4: สร้าง notification, dismiss แล้วไม่ขึ้นซ้ำ บัญชีอื่น dismiss ไม่ได้ และยังดูย้อนหลังได้ ต้องลอง popup ข้ามแท็บ/login สองรอบด้วยบัญชีจริง |
| AC-26 | Daily two tries | PASS (local) | S13 + UI: ผิดครั้งแรกเห็น hint ถูกครั้งที่สองได้ +1 ครั้งที่สามได้ 409 |
| AC-27 | Daily partial multi | PASS (local) | S17 |
| AC-28 | One wrong abandon | PASS (local) | S13 |
| AC-29 | Exam preserves Fire | PASS (local) | S19: ส่งเองและหมดเวลาอัตโนมัติ |
| AC-30 | Race idempotency | PASS (local) | S14: 100 คำขอพร้อมกันเพิ่มไฟครั้งเดียว |
| AC-31 | Midnight cutoff | PASS (local) | S15: เวลา server หลังเที่ยงคืนปฏิเสธวันเก่า; archive practice ไม่เพิ่มไฟ |
| AC-32 | Miss + recover | PASS (local) | S16 |
| AC-33 | Recovery cap tiers | PASS (local) | S16: 3/4/5/6; remaining ไม่ติดลบ |
| AC-34 | Highest persisted | PASS (local) | S16 |
| AC-35 | Fallback queue | PASS (local) | S18: วันที่ระบุชนะคิว, คิวใช้ครั้งเดียว, วันไม่มีโจทย์ auto-protect |
| AC-36 | Regrade preserve | PASS (local) | S20 |
| AC-37 | CSV import daily | PASS (local) | S21: XLSX จริงนำเข้าได้; CSV เสียไม่มีแถวบางส่วน |
| AC-38 | Permissions | PASS (local) | S4, S25: Author อ่าน ranking/keys ไม่ได้; ถอนสิทธิ์แล้ว session เดิมได้ 403 ใน request ถัดไป |
| AC-39 | Restore | PASS (local) + ตรวจบนระบบจริง | R: กู้ DB + keys + ไฟล์ใบ + ลายเซ็น และ physical PITR ตรงเวลาเป้าหมาย ต้องทำ drill ซ้ำบนโฮสต์จริงพร้อม off-site และวัด RPO/RTO จริง |
| AC-40 | 500 concurrent | PASS (local) + ตรวจบนระบบจริง | L: 500 active VU, 5,500 requests, 0 errors บน Linux/Bun Docker; ต้องรันซ้ำบนโฮสต์ที่เลือกและตกลง SLA |

สรุป: 34 ข้อ PASS (local) ครบ; 6 ข้อ (AC-01, 05, 21, 25, 39, 40) ผ่านในส่วนที่ทำได้บนเครื่อง และเหลือการตรวจบนระบบจริงตามที่ระบุ

## Requirement coverage นอกเหนือจาก AC

| กลุ่ม | สถานะ | หลักฐาน / ข้อจำกัด |
|---|---|---|
| CERT-01–15 | Included | C1–C14, S5; คู่มือระบุว่าไม่พิสูจน์ไฟล์ระดับพิกเซล (CERT-13) |
| STAT-01–04, 06–14 | Included | S1–S10, D6, D7 |
| STAT-05 | Included | A1–A8: เบราว์เซอร์ส่งบันทึกเวลาแบบลำดับต่อเนื่อง (sequence, active/offline ms) ทั้งตอนออนไลน์และส่งตามหลัง offline; server ตรวจขอบเขต ไม่เกินเวลาสิ้นสุดที่ server บันทึก; เวลา offline หรือหลายแท็บไม่ถูกเพิ่มเข้าเวลาที่ใช้เรียงอันดับเอง แต่ติดธงให้ Admin ตรวจหลักฐานแล้วรับรองพร้อม preview/audit (A5); เวลาที่รับรองแล้วใช้ใน tie-break จริง (A6) ไม่ใช้ wall-clock แทน |
| CMS-01–09 + Editor | Included | S11, S12, S24, S27, D1–D3; ค้นหาจากบทความสูงสุด 5,000 รายการต่อครั้ง ถ้าเกินต้องตัดสินใจเรื่อง search index |
| FIRE-01–13 + 6.4 | Included | S13–S23, D5; Extend (S23) ขยายได้เฉพาะโจทย์วันนี้ก่อนเที่ยงคืน เพราะหลังเที่ยงคืนเฉลยเปิดแล้ว |
| 7.1 Dashboard | Included | D4, UI; ประวัติสอบแสดงระดับชั้น/วิชาของชุดสอบแล้ว |
| 8 Admin / Permission / Audit | Included | S4, S25, D6, UI (`audit-actor-confirm.png`) |
| 10.1 Security | Included | S5, S10, S24, D3, C9; ไม่ใช่ penetration test โดยบุคคลที่สาม |
| 10.2 Privacy / Retention | Included | D8: Owner อนุมัติรายหมวด; ลบอัตโนมัติเฉพาะ technical logs และ learning events (ไม่มีข้อมูลอ้างอิง) พร้อม audit; หมวดที่เชื่อมโยงกันบันทึกนโยบายและดำเนินการตามแผน lifecycle; S26, C14: ลบบัญชีพร้อม consent |
| 10.3 Backup / PITR | Included (local) | R; ปลายทาง off-site และ RPO/RTO จริงรอ Owner เลือกโฮสต์ |
| 11.1 Load | Included (local) | L |

## Evidence ตามข้อ 11.3

| รายการที่ SoW ขอ | ไฟล์ |
|---|---|
| Test Case sheet พร้อม PASS/FAIL | เอกสารนี้ + `*-test-result.json` |
| Screenshot (ไม่มีข้อมูลจริง) | `screenshots/` (บัญชีจำลองทั้งหมด), `ui-review.md` |
| API Test Notes | `api-contract.md`, `api-contract.json` (163 routes) |
| Load Test Result | `load-500-result.json`, `load-test-notes.md`, `load-500-macos-transport-failure.json` (รอบที่ล้มเพราะ transport บน macOS เก็บไว้ไม่ซ่อน) |
| Security / Access Test Result | S4, S5, S10, S24, S25, C1, C9, D3, A3 ในไฟล์ผลด้านบน |
| Backup Restore Report | `restore-drill-result.json`, `pitr-drill-result.json`, `operations-guide.md` |
| QR และ Signature verification | `pdf-qr-result.json`, C7–C9, `m1-certificate-validation.md` |
| CSV import samples | `samples/daily-valid.csv`, `samples/daily-invalid.csv`, `samples/ranking-template.csv` |
| Source code revision / commit | ผู้ใช้เป็นผู้ commit เอง ยังไม่มี commit ของงานรอบนี้ |
| คู่มือประกอบ | `user-admin-guide.md`, `operations-guide.md`, คู่มือ PDF เดิมสองฉบับ |

## งานที่ต้องตรวจบนระบบจริง (ทำแทนไม่ได้จากเครื่องพัฒนา)

1. ตั้งโดเมนและ Google OAuth production แล้วทดสอบ AC-01 ด้วยบัญชีจริงสองบัญชี
2. สแกน QR ด้วยกล้องโทรศัพท์จาก PDF ที่พิมพ์และภาพที่แชร์ผ่านแอป (AC-05)
3. แชร์ลิงก์บทความใน LINE (AC-21) และลอง popup แจ้งเตือนด้วยบัญชีจริง (AC-25)
4. Load test 500 ผู้ใช้ และ restore/PITR drill บนโฮสต์ที่เลือก พร้อมตัวเลข RPO/RTO จริง (AC-39, AC-40)
5. Owner อนุมัติ retention, ปลายทาง off-site backup, age identity และบัญชี Owner สำรอง

ห้ามเปลี่ยนสถานะห้าข้อนี้เป็น production PASS จนกว่าจะมีหลักฐานจากระบบจริง

ขั้นตอนทำบนเครื่อง server พร้อมตารางบันทึกผล: `server-acceptance-runbook.md`
