# คู่มือ Deploy, Backup และกู้คืน — ส่วนเพิ่ม SoW 2026

เวอร์ชัน 2026-11-14 (ปรับปรุง 20:20 น.) ใช้ร่วมกับคู่มือ PDF เดิม งานรอบนี้ยังไม่ได้ deploy/commit/push ไป production

## การนำขึ้นระบบ

1. สำรองฐานข้อมูล ไฟล์ uploads, certificates, cert-keys และเก็บ revision ของ source ที่จะ deploy ตรวจว่ากู้ backup ได้ก่อนเปลี่ยนระบบจริง
2. ตั้งค่าใน `docker/.env` จาก `.env.example` ให้ครบ โดยเฉพาะ Google OAuth callback, PUBLIC_URL_DOCKER และ ADMIN_API_KEY ของ Owner ห้ามใส่ค่าลับใน repository หรือรูปตรวจรับ
3. ใช้ `docker compose -f docker/docker-compose.yml config --quiet` ตรวจ config แล้ว build/deploy ด้วยขั้นตอนเดิม Backend จะใช้ migration 0017–0024 จากประวัติ Drizzle ซึ่งเพิ่มตาราง/คอลัมน์อย่างเดียว ไม่ลบตารางเดิม ห้ามใช้ `db:push` บนข้อมูลจริง
4. ตรวจ persistent volumes `uploads_data`, `certificates_data`, `cert_keys_data` และสิทธิ์เข้าถึงไฟล์ private; ไฟล์เหล่านี้ถูกกันออกจาก Docker build context หน้า `/admin/` เป็น static export ใน Caddy; `/api/` ไป backend; หน้าเว็บนักเรียนใช้ BACKEND_URL ภายใน Docker
5. ใส่อีเมล Google ของ Owner อย่างน้อยสองบัญชีใน `OWNER_EMAILS` ก่อน deploy (admin ทั่วไปเปิดหน้าผู้ใช้และสิทธิ์ไม่ได้) จากนั้นเข้า Admin ด้วยบัญชีนั้น หรือ tooling key ของ Owner แล้วมอบ `staffRole: owner` ให้บัญชี Google อย่างน้อยสองบัญชีใน Users/Permissions ไม่ส่ง private key หรือ API key ให้ผู้เขียนบทความ การถอนสิทธิ์มีผลต่อคำขอถัดไปของ session เดิม
6. ตรวจ HTTPS, OAuth บัญชีจริง A/B, การอ่านคะแนนตนเอง/ปฏิเสธของผู้อื่น, สร้าง/ดาวน์โหลดใบจริง, ตั้งเวลาเผยแพร่ และโจทย์ประจำวันบนโฮสต์จริง

ถ้า Owner ทุกบัญชีเข้าระบบไม่ได้ ผู้ดูแล infrastructure ที่ Owner แต่งตั้งใช้ ADMIN_API_KEY เดิมเข้าประตู Admin เพื่อคืนสิทธิ์ให้บัญชี Google ที่ตรวจสอบแล้ว จากนั้นทบทวน Audit และหมุน tooling key หากสงสัยว่ารั่ว การคืนสิทธิ์นี้เป็นการปฏิบัติงานโดยผู้รับผิดชอบจริง ไม่ใช่การเปิดหน้า recovery สาธารณะ

### Environment variables (ชื่อเท่านั้น ห้ามใส่ค่าในเอกสาร)

ตั้งใน `docker/.env` ซึ่งไม่อยู่ใน repository ตัวอย่างและคำอธิบายอยู่ใน `docker/.env.example`

| กลุ่ม | ตัวแปร | หมายเหตุ |
|---|---|---|
| ฐานข้อมูล | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_POOL_MAX` | compose สร้าง `DATABASE_URL` ให้ backend เอง |
| URL / HTTPS | `SITE_ADDRESS`, `PUBLIC_URL_DOCKER`, `PUBLIC_URL`, `BACKEND_PORT` | `PUBLIC_URL_DOCKER` ต้องเป็นโดเมนจริง เพราะใช้ทั้ง OAuth callback, Origin check และ URL ใน QR เกียรติบัตร |
| ผู้ดูแล | `ADMIN_API_KEY`, `ADMIN_EMAILS`, `OWNER_EMAILS`, `ALLOW_DEV_AUTH` | production ต้องตั้ง `ALLOW_DEV_AUTH=0`; `OWNER_EMAILS` ต้องมีอย่างน้อยสองอีเมล ไม่อย่างนั้นไม่มีใครจัดการผู้ใช้และสิทธิ์ได้ |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | บัญชี Google Cloud ของ Owner |
| การชำระเงิน / AI เดิม | `OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL` | ไม่เกี่ยวกับ SoW 2026 แต่ต้องคงไว้ |
| ไฟล์ | `CERT_DIR`, `CERT_KEY_DIR`, `UPLOAD_DIR` | compose ชี้ไป volume `certificates_data`, `cert_keys_data`, `uploads_data` |
| Backup | `BACKUP_AGE_RECIPIENT`, `BACKUP_INTERVAL_SECONDS` | ใส่เฉพาะ public recipient ของ age |

### Rollback

1. ก่อน deploy ทุกครั้ง: จด git revision ที่ใช้อยู่ ทำ backup ตามหัวข้อถัดไป และตรวจว่าถอดรหัส/กู้คืนได้
2. ถ้า frontend หรือ backend มีปัญหาแต่ฐานข้อมูลยังปกติ: build/deploy revision ก่อนหน้าด้วย compose เดิม migration 0017–0024 เพิ่มตาราง/คอลัมน์อย่างเดียว โค้ดรุ่นก่อนจึงยังทำงานกับ schema ใหม่ได้ ห้ามลบตาราง/คอลัมน์ใหม่ด้วยมือ
3. ถ้าข้อมูลเสียหายจากงานรอบใหม่: หยุด backend และ worker แล้วกู้ด้วยขั้นตอน "กู้คืนจริง" ไปยังฐานข้อมูลใหม่ ตรวจผลแล้วจึงสลับ connection ห้าม restore ทับฐานที่ใช้งานอยู่
4. บันทึกเหตุผล เวลา revision ที่ถอย และผลตรวจใน Audit/บันทึกงาน ตรวจ certificate queue, scheduled publish และ Daily cutoff หลังถอยทุกครั้ง

## Backup และ PITR

มี overlay ที่ยังไม่ถูกนำไปใช้กับ production: `docker/docker-compose.backup.yml` และ image `docker/backup.Dockerfile` งานรายวันสร้าง logical dump, physical base backup พร้อม WAL และสำเนา assets แล้วเข้ารหัส age แบบ recipient public key ตั้งแต่ก่อนนำไฟล์ออกจาก temporary directory ไฟล์ส่งออกเป็น `.tar.gz.age` และ checksum; private age identity ต้องอยู่กับ Owner แยกจากโฮสต์/ชุดสำรอง

```sh
# Owner สร้าง age identity นอก repository และนำเฉพาะ public recipient มาใส่ .env
# BACKUP_AGE_RECIPIENT=age1...
docker compose -f docker/docker-compose.yml -f docker/docker-compose.backup.yml config --quiet
docker compose -f docker/docker-compose.yml -f docker/docker-compose.backup.yml up -d --build
```

Overlay เปิด PostgreSQL archive_mode, wal_level=replica, archive_timeout=60s และ WAL volume ที่จำกัดสิทธิ์ Backup container ใช้ network namespace ของ PostgreSQL เพื่อใช้ replication authentication บน localhost โดยไม่เพิ่มกฎอนุญาต replication กว้าง ๆ บน network งานล้มเหลวจะออกด้วย error ให้ restart policy ลองใหม่และเห็นใน container logs ต้องติดตามทั้งสถานะงานสำรองกับพื้นที่ว่างของ WAL

**ข้อจำกัดการสูญหายที่ต้องตกลงบนโฮสต์จริง:** daily encrypted bundle อย่างเดียวมีช่วงสูญหายได้ถึงหนึ่งวันเมื่อทั้งโฮสต์หาย Continuous WAL บน volume เดียวกันช่วยกู้ฐานข้อมูลย้อนเวลาเมื่อดิสก์ยังอยู่ แต่ยังไม่ใช่ off-site disaster recovery ต้องเลือกปลายทางของ Owner และส่ง WAL/backup แบบต่อเนื่องออกต่างโฮสต์ด้วยการเข้ารหัสก่อนประกาศ RPO 60 วินาที Owner ต้องอนุมัติพื้นที่สำรอง retention ปริมาณ storage และทดสอบ RPO/RTO กับข้อมูล/เครื่องจริงก่อนตรวจรับ production ไม่ตั้งค่า cloud account หรือคิดค่าใช้บริการแทน Owner ในรอบนี้

หลักฐานใน repository:

- `restore-drill-result.json`: logical restore ของฐานข้อมูลจำลอง พร้อม private signing key, certificate metadata, PNG/PDF และตรวจลายเซ็นหลัง restore
- `pitr-drill-result.json`: PostgreSQL16 จำลองใน Docker, age encrypt/decrypt, กู้ physical base + WAL จนถึง target timestamp ได้สองแถว และตัดแถวที่สามที่ commit หลังเวลาเป้าหมาย; ตรวจ assets และ promote สำเร็จ
- ค่าระยะเวลาที่วัดเป็น fixture RTO เท่านั้น ไม่ใช่ SLA ของระบบจริง

ทำซ้ำจาก `backend/app`:

```sh
bun run test:restore
# build จาก root ก่อน: docker build -f docker/backup.Dockerfile -t pipol-backup-sow:local .
bun run scripts/pitr-drill.ts
```

สคริปต์สร้างฐานข้อมูล/container/volume ชื่อสุ่ม แล้วลบเฉพาะสิ่งที่สร้างในรอบนั้น ไม่มีการ reset ฐานข้อมูลแอป

### กู้คืนจริง

1. ระงับการเขียน/worker เลือก backup และเวลาเป้าหมาย ตรวจ checksum แล้วใช้ age identity ของ Owner ถอดรหัสในพื้นที่จำกัดสิทธิ์
2. Logical recovery: สร้าง DB ใหม่, `pg_restore --exit-on-error` ไป DB ใหม่และวาง assets ลง volumes ใหม่ ห้ามทับ DB ที่ยังใช้งาน
3. PITR: ใช้ PostgreSQL major version เดิม วาง `base/` ลง PGDATA ใหม่, ตั้ง owner/mode ให้ postgres, วาง WAL ที่ต่อเนื่องถึงเป้าหมายในพื้นที่อ่านอย่างเดียว, กำหนด `restore_command`, `recovery_target_time`, `recovery_target_action='promote'` ใน postgresql.auto.conf แล้วสร้าง recovery.signal ห้าม start ด้วย volumes production เดิม
4. ตรวจผู้ใช้/จำนวน attempts/revisions, public verify ทั้งใบใหม่และใบเก่า, signature, ดาวน์โหลด PNG/PDF และ key history ตรวจ worker ที่ค้างและ audit ของช่วง outage
5. บันทึกจุดเวลาล่าสุดที่กู้ได้จริง RPO/RTO, สิ่งที่ขาด และผู้อนุมัติ แล้วค่อยสลับ connection หลังทดสอบ ไม่ลบ backup ก่อนยืนยัน

## Recovery กรณีงานค้าง

**ใบประกาศ:** ดู Certificates และ Error/Audit; ตรวจ storage/native renderer/key volume ก่อน Retry ระบบใช้ certificate/job เดิม ไม่สร้าง ID ใหม่เพราะกดซ้ำ Backoff สูงสุด 10 นาที หลัง 8 ครั้งจะขึ้น failed ให้ผู้ดูแล retry จากหน้า Admin งาน running ที่เก่ากว่า 10 นาทีจะถูกคืน pending เมื่อ worker เริ่มระบบใหม่ ห้ามแก้ status เป็น valid โดยตรง ใช้การสร้าง revision ใหม่เมื่อต้องเปลี่ยนข้อมูลสำคัญ

**CSV/XLSX:** preview ไม่แก้คำตอบดิบ Commit เป็น transaction; ถ้า client ไม่ทราบผล ให้ reload revision/audit ตาม previewId ก่อนทำซ้ำ หาก commit แล้วการส่งซ้ำตอบ409 ถ้ายังไม่ commit แต่ข้อมูลเปลี่ยนต้อง preview ใหม่ การนำเข้าแถวเสียปฏิเสธทั้งไฟล์ ตัวอย่างอยู่ `samples/`

**Fire/cutoff:** ใช้วัน Asia/Bangkok ของ server ดู Fire Ledger ก่อนเลือก protect/compensate/bulk_recover ช่วงวันและผู้ได้รับผลต้องผ่าน preview พร้อมเหตุผล การกู้ชดเชยของ admin ไม่ใช้โควตาผู้เรียน `extend` ใน V1 ใช้มาตรการรักษาวันที่เลือก ไม่เปิดรับ daily answer ของวันที่ปิดแล้ว ชื่อใน UI อธิบายมาตรการนี้ การคืนไฟหลัง lost ใช้ previousCurrent ที่เก็บใน ledger และไม่คืนซ้ำ

**Daily ขยายเวลา (Extend):** ใช้ได้เฉพาะโจทย์ของวันนี้ก่อนปิดรับ 23:59:59 น. เวลาไทย เลือกเวลาสิ้นสุดได้ไม่เกิน 24 ชั่วโมงหลังเวลาปิดปกติ ผู้เรียนในกลุ่มที่เลือก (หรือทุกคน) ส่งคำตอบของวันนั้นต่อได้และได้ไฟของวันนั้นตามกติกาปกติ ระหว่างขยายเวลา ระบบยังไม่เปิดเฉลย ไม่แสดงวันนั้นในคลังย้อนหลัง และไม่คัดลอกโจทย์เข้าคลังข้อสอบ เมื่อหมดเวลาจึงประเมินไฟของวันนั้นตามปกติ (พลาด = รอกู้/หมดสิทธิ์) ถ้าระบบล่มจนเลยเที่ยงคืนไปแล้ว เฉลยถูกเปิดแล้วจึงขยายเวลาไม่ได้ ให้ใช้ protect/compensate/bulk_recover แทน

**Signing keys:** Owner ใช้ปุ่มหมุน key ใน Certificates เก็บ public key เก่าไว้เพื่อ verify ใบเดิม สำรอง private keys แบบเข้ารหัสพร้อม metadata/ไฟล์ ทดสอบใบก่อนและหลังหมุน ห้ามลบ key เก่าที่ใบยัง valid หรือคัดลอก key ลง frontend/log

## Privacy, retention และ storage

หน้า Operations เสนอ technical logs 30 วัน และหมวดอื่น 365 วันแยก Profile/Attempts/Result revisions/Certificates/Comments/Learning events/Audit Owner เปลี่ยนจำนวนวันหรือเว้นว่างเพื่อเก็บต่อและอนุมัติเป็นเวอร์ชันได้

การลบอัตโนมัติ (ทุกชั่วโมงใน maintenance loop ของ backend) ทำเฉพาะหมวดที่ไม่มีข้อมูลอื่นอ้างอิงและเฉพาะเมื่อ Owner อนุมัติจำนวนวันแล้ว:

- `technical_logs` = ตาราง `error_logs`
- `learning_events` = ตาราง `article_events` (ยอดเข้าชม/คลิกบทความ) ยอดสถิติย้อนหลังของบทความจะลดลงตามช่วงที่ลบ ถ้าต้องการเก็บยอดตลอดให้อนุมัติเป็นค่าว่าง

ทุกรอบที่ลบได้จะเขียน Audit `retention.purge` (actor = system) พร้อมจำนวนแถว cutoff และ policy version หมวด Profile/Attempts/Result revisions/Certificates/Comments/Audit มี FK และหลักฐานเชื่อมโยง ระบบบันทึกนโยบายไว้แต่ไม่ลบเอง ต้องใช้แผน lifecycle ที่ Owner อนุมัติ ตรวจ restore แล้วดำเนินการเป็นงานแยก

การลบบัญชีทำงานทันที: เก็บ consent keep/revoke, ทำ profile และ identity snapshots ใน attempts ให้ไม่ระบุตัวบุคคล, ลบข้อความ comment, ถอน sessions ถ้า revoke จะถอนใบทุก revision และลบ manifest/name fields ที่ใช้ระบุตัวบุคคล ถ้า keep จะคงชื่อที่ลงนามไว้เพื่อ verify ตามคำยินยอม Audit/revision snapshots และไฟล์สำรองอาจมีข้อมูลเก่าที่จำเป็นต่อหลักฐานและจำกัดสิทธิ์ ต้องรวมในรอบ retention ที่ Owner อนุมัติ ไม่เปิดผ่าน public API

Storage planning ใช้ขนาดจริงจากโฮสต์: `DB + WAL + uploads + จำนวนใบ×(PNG+PDF) + keys + จำนวนชุด backup×ขนาดหลังเข้ารหัส` บวกพื้นที่ temporary สำหรับ base backup และ restore drill ห้ามประมาณจากจำนวนผู้ใช้เพียงอย่างเดียว การเก็บ WAL ไม่จำกัดทำให้ดิสก์เต็มได้ จัดรอบเก็บ/ยืนยัน off-site archive ก่อน prune

## Performance และ logging

ดู `load-500-result.json` และ `load-test-notes.md` สำหรับรูปแบบ 500 active virtual users ค่าล่าสุดเป็น local Docker/Linux ไม่ใช่การรับรองจำนวนเครื่องจริงหรือราคา hosting Error log อยู่ใน PostgreSQL `error_logs`; job errors อยู่ใน certificate_jobs; audit แยกตามสิทธิ์ ข้อความ error สาธารณะมี requestId โดยไม่ส่ง credential Advanced alerting/remote logging และการทดสอบเครือข่ายภายนอกยังต้องเลือกบริการ/โฮสต์ของ Owner

## แผนดูแลหลัง Go-live และ Training

- สัปดาห์แรก: ตรวจทุกวัน — Error log, certificate queue (failed/retryable), งาน backup ล่าสุดและพื้นที่ WAL, Daily cutoff/Fire ledger ของเมื่อวาน, บทความที่ตั้งเวลาไว้ ผล Audit การเปลี่ยนสิทธิ์
- หลังสัปดาห์แรก: ตรวจรายสัปดาห์ และทำ restore drill จาก backup จริงอย่างน้อยเดือนละครั้งในฐานข้อมูลแยก
- ช่องทางแจ้งปัญหา เวลาตอบกลับ และระยะรับประกัน 30 วัน (Critical/High/Normal) เป็นข้อตกลงในสัญญา เอกสารนี้ไม่กำหนดแทน
- Training ที่ต้องจัดให้ Owner/ทีม (ใช้ `user-admin-guide.md` เป็นเนื้อหา): มอบสิทธิ์และ Owner สำรอง; Template/ออกใบ/หมุน key; ตรวจธงและรับรองเวลาสอบ (STAT-05) ก่อนเผยแพร่ Final; import/rollback ผลรับรอง; เขียน/อนุมัติ/ตั้งเวลาบทความและตรวจความคิดเห็น; สร้าง/นำเข้า Daily, regrade และการชดเชยเมื่อระบบขัดข้อง; อนุมัติ retention และอ่าน Audit/Error
