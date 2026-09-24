/**
 * Seeds the catalogue with the prices from PRODUCT.md.
 * Idempotent: products are inserted once and then owned by the admin panel
 * (title, price, active), so a re-seed never overwrites an admin edit.
 * Run with: bun run db:seed
 */
import { sql as raw } from "drizzle-orm";

import { db, sql } from ".";
import { examPacks, examSettings, packProducts, packQuestions, products, questions } from "./schema";
import { DEFAULT_EXAM_SETTINGS } from "../exam-settings";

const catalogue = [
  {
    slug: "exam-pack",
    kind: "exam_pack" as const,
    title: "ชุดข้อสอบเสมือนจริง",
    priceSatang: 590_00,
  },
  {
    slug: "full-course",
    kind: "course" as const,
    title: "คอร์สติวเต็ม",
    priceSatang: 4_900_00,
  },
  {
    slug: "course-plus-packs",
    kind: "bundle" as const,
    title: "คอร์สติวเต็ม + ชุดข้อสอบทั้งหมด",
    priceSatang: 5_200_00,
  },
  // Fortune topics: each active fortune product is one topic the student
  // picks on /fortune, priced separately. Placeholder prices; the admin sets
  // the real ones. fortune-single keeps its slug so existing orders stay put.
  {
    slug: "fortune-single",
    kind: "fortune" as const,
    title: "ดูดวงการสอบ",
    priceSatang: 99_00,
  },
  {
    slug: "fortune-campus",
    kind: "fortune" as const,
    title: "ดูดวงเลือกสนามสอบ",
    priceSatang: 149_00,
  },
  {
    slug: "fortune-overall",
    kind: "fortune" as const,
    title: "ดูดวงรวม",
    priceSatang: 199_00,
  },
  // Never sold (there are no reading credits); kept only so the row is closed.
  {
    slug: "fortune-pack-3",
    kind: "fortune" as const,
    title: "ดูดวง 3 ครั้ง",
    priceSatang: 249_00,
    active: false,
  },
];

await db.insert(products).values(catalogue).onConflictDoNothing({ target: products.slug });

console.log(`seeded ${catalogue.length} products`);

// Exam settings: insert the placeholder row once; an admin edit is never
// overwritten by a re-seed.
await db
  .insert(examSettings)
  .values({ key: "default", ...DEFAULT_EXAM_SETTINGS })
  .onConflictDoNothing({ target: examSettings.key });
console.log("seeded exam settings (kept existing row if present)");

// One mock pack. Placeholder duration: 90 minutes for 100 questions; the
// multiplier in exam_settings stretches it.
const [mockPack] = await db
  .insert(examPacks)
  .values({
    slug: "mock-100",
    title: "ข้อสอบเสมือนจริง ชุดที่ 1",
    questionCount: 100,
    durationSeconds: 90 * 60,
  })
  .onConflictDoUpdate({
    target: examPacks.slug,
    set: { title: raw`excluded.title`, durationSeconds: raw`excluded.duration_seconds` },
  })
  .returning({ id: examPacks.id });
console.log("seeded exam pack mock-100");

// The pack is unlocked by the exam-pack tier and the bundle ("all packs").
// Only adds links; an admin removing one is not re-added.
const unlockers = await db
  .select({ id: products.id })
  .from(products)
  .where(raw`${products.slug} in ('exam-pack', 'course-plus-packs')`);
if (mockPack && unlockers.length > 0) {
  await db
    .insert(packProducts)
    .values(unlockers.map((p) => ({ packId: mockPack.id, productId: p.id })))
    .onConflictDoNothing({ target: [packProducts.packId, packProducts.productId] });
  console.log(`linked mock-100 to ${unlockers.length} products`);
}

// Sample bank so the admin picker and the exam UI have something to show.
// Placeholder content; the answer key here is not a real key.
const KEYS = ["ก", "ข", "ค", "ง"];
const choices = (texts: string[]) => texts.map((text, i) => ({ key: KEYS[i]!, text }));
const sampleQuestions = [
  { subject: "math" as const, topic: "สมการเชิงเส้น", prompt: "ถ้า 3x + 7 = 25 แล้วค่าของ x² − 2x เท่ากับข้อใด", choices: choices(["18", "24", "30", "36"]), correctChoice: "ข", explanation: "x = 6 ดังนั้น 36 − 12 = 24" },
  { subject: "math" as const, topic: "อัตราส่วน", prompt: "น้ำผลไม้ผสมน้ำเชื่อมในอัตราส่วน 3 : 2 ถ้ามีน้ำผลไม้ 450 มิลลิลิตร ต้องใช้น้ำเชื่อมกี่มิลลิลิตร", choices: choices(["200", "270", "300", "675"]), correctChoice: "ค", explanation: "450 ÷ 3 × 2 = 300" },
  { subject: "math" as const, topic: "เรขาคณิต", prompt: "สี่เหลี่ยมผืนผ้ากว้าง 6 ซม. มีเส้นทแยงมุมยาว 10 ซม. พื้นที่เท่ากับกี่ตารางเซนติเมตร", choices: choices(["36", "48", "60", "80"]), correctChoice: "ข", explanation: "ยาว = 8 ซม. พื้นที่ = 48" },
  { subject: "math" as const, topic: "จำนวนและการดำเนินการ", prompt: "ผลบวกของจำนวนคี่ตั้งแต่ 1 ถึง 39 เท่ากับข้อใด", choices: choices(["361", "380", "400", "441"]), correctChoice: "ค", explanation: "20 จำนวน → 20² = 400" },
  { subject: "science" as const, topic: "แรงและการเคลื่อนที่", prompt: "วัตถุเคลื่อนที่ด้วยความเร็วคงที่ 12 เมตรต่อวินาที ใน 1 นาทีเคลื่อนที่ได้ระยะทางเท่าใด", choices: choices(["12 เมตร", "72 เมตร", "720 เมตร", "7,200 เมตร"]), correctChoice: "ค", explanation: "12 × 60 = 720" },
  { subject: "science" as const, topic: "สารและสมบัติของสาร", prompt: "ข้อใดเป็นการเปลี่ยนแปลงทางเคมี", choices: choices(["น้ำแข็งละลาย", "เหล็กเป็นสนิม", "น้ำเดือด", "เกลือละลายน้ำ"]), correctChoice: "ข", explanation: "สนิมเป็นสารใหม่" },
  { subject: "general_aptitude" as const, topic: "อนุกรม", prompt: "2, 6, 12, 20, 30, … จำนวนถัดไปคือข้อใด", choices: choices(["40", "42", "44", "48"]), correctChoice: "ข", explanation: "ผลต่างเพิ่มทีละ 2: 4,6,8,10,12" },
  { subject: "thai" as const, topic: "คำและความหมาย", prompt: "คำในข้อใดเป็นคำประสม", choices: choices(["แม่น้ำ", "แม่", "น้ำ", "ไหล"]), correctChoice: "ก", explanation: "แม่ + น้ำ เกิดความหมายใหม่" },
  { subject: "english" as const, topic: "Grammar", prompt: "She ____ to school every day.", choices: choices(["go", "goes", "going", "gone"]), correctChoice: "ข", explanation: "Third-person singular present" },
];

const [bankCount] = await db.select({ n: raw<number>`count(*)` }).from(questions);
if (Number(bankCount?.n ?? 0) === 0) {
  const inserted = await db.insert(questions).values(sampleQuestions).returning({ id: questions.id });
  const [pack] = await db.select({ id: examPacks.id }).from(examPacks).where(raw`${examPacks.slug} = 'mock-100'`).limit(1);
  if (pack) {
    await db.insert(packQuestions).values(inserted.map((q, i) => ({ packId: pack.id, questionId: q.id, position: i + 1 })));
  }
  console.log(`seeded ${inserted.length} sample questions into mock-100`);
} else {
  console.log("question bank not empty, left as is");
}
await sql.end();
