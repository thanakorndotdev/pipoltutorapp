/**
 * Copy and placeholder content shared across screens. Everything here that
 * looks like a fact (tutor name, dates, plan copy) is placeholder per
 * PRODUCT.md ASSUMPTIONS and must be replaced before launch. Cohort number,
 * seats left and testimonials were removed on 2026-09-15 — reintroduce them
 * only from real data.
 */

export const TUTOR_NAME = "พี่ที";

/** Placeholder exam date (25 มกราคม 2569). */
export const EXAM_DATE = new Date("2026-01-25T00:00:00+07:00");
export const EXAM_DATE_LABEL = "25 มกราคม 2569";
export const ENROLL_CLOSE_LABEL = "30 กันยายน 2568";
export const COURSE_START_LABEL = "5 ต.ค. 2568";

/** LINE deep link placeholder — the client has not supplied an account. */
export const LINE_URL = "https://line.me/R/ti/p/@pipoltutor";

export type Plan = {
  slug: "exam-pack" | "full-course" | "course-plus-packs";
  tag: string;
  name: string;
  desc: string;
  price: number; // baht, fallback only — getPlans() swaps in the admin-set DB price
  unit: string;
  cta: string;
  hot: boolean;
  feats: string[];
};

export const PLANS: Plan[] = [
  {
    slug: "exam-pack",
    tag: "ชุดข้อสอบ",
    name: "ชุดข้อสอบเสมือนจริง",
    desc: "เหมาะกับคนที่อยากวัดระดับตัวเองก่อน",
    price: 590,
    unit: "/ ชุด",
    cta: "สมัครชุดข้อสอบ",
    hot: false,
    feats: [
      "ข้อสอบจำลอง 100 ข้อ ครบ 5 วิชา",
      "จับเวลาเสมือนห้องสอบจริง",
      "ตรวจอัตโนมัติ + สรุปรายบท",
      "ทำซ้ำได้ 3 ครั้ง",
    ],
  },
  {
    slug: "full-course",
    tag: "ยอดนิยม",
    name: "คอร์สติวเข้า จภ. เต็มรูปแบบ",
    desc: "คอร์สหลัก สอนสดครบทุกวิชาจนถึงวันสอบ",
    price: 4900,
    unit: "/ คอร์ส",
    cta: "สมัครคอร์สนี้",
    hot: true,
    feats: [
      "ติวสด 24 ครั้ง + คลิปย้อนหลัง",
      "เอกสารประกอบการเรียนแบบพิมพ์",
      "ชุดข้อสอบเสมือนจริง 1 ชุด",
      "กลุ่ม LINE ถามได้ตลอด",
      "ติวเสริมเฉพาะกลุ่มก่อนสอบ",
    ],
  },
  {
    slug: "course-plus-packs",
    tag: "คุ้มที่สุด",
    name: "คอร์ส + คลังข้อสอบทั้งหมด",
    desc: "ได้ทุกอย่างของคอร์สหลัก บวกคลังข้อสอบทุกชุด",
    price: 5200,
    unit: "/ แพ็ก",
    cta: "สมัครแพ็กนี้",
    hot: false,
    feats: [
      "ทุกอย่างในคอร์สเต็มรูปแบบ",
      "คลังข้อสอบทุกชุด ไม่จำกัดครั้ง",
      "รายงานวิเคราะห์รายสัปดาห์",
      "ดูดวงแนวทางการสอบ 1 ครั้ง",
    ],
  },
];

export type NavId = "home" | "about" | "courses" | "exam" | "fortune";

/** `about` has no fixed label: the header renders `รู้จัก${tutorName}` from site copy. */
export const NAV: { id: NavId; label: string; href: string }[] = [
  { id: "home", label: "หน้าแรก", href: "/" },
  { id: "about", label: `รู้จัก${TUTOR_NAME}`, href: "/about" },
  { id: "courses", label: "คอร์สเรียน", href: "/courses" },
  { id: "exam", label: "คลังข้อสอบ", href: "/exam" },
  { id: "fortune", label: "ดูดวง", href: "/fortune" },
];
