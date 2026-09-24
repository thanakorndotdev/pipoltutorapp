/**
 * Slots the admin can fill with an image. The key is what the frontend asks
 * for; label/hint/ratio drive the admin "รูปภาพเว็บไซต์" page. Add a slot here,
 * then read it in the frontend with <SiteImage slot="..."> — no migration.
 */
export type SiteAssetSlot = {
  key: string;
  label: string;
  hint: string;
  /** CSS aspect-ratio of the placeholder the image replaces. */
  ratio: string;
  group: "brand" | "landing" | "about" | "courses";
};

export const SITE_ASSET_SLOTS: readonly SiteAssetSlot[] = [
  { key: "favicon", label: "Favicon (ไอคอนแท็บเบราว์เซอร์)", hint: "สี่เหลี่ยมจัตุรัส · PNG 32×32 ถึง 512×512 (ใช้เป็น icon ของทั้งเว็บ)", ratio: "1 / 1", group: "brand" },
  { key: "logo", label: "โลโก้", hint: "สี่เหลี่ยมจัตุรัส · แสดงในแถบเมนูและท้ายเว็บ (42×42 px, ควรเป็น PNG/WebP พื้นหลังโปร่ง)", ratio: "1 / 1", group: "brand" },
  { key: "hero_portrait", label: "รูปพี่ที — ภาพหลัก", hint: "แนวตั้ง 4:4.5 · ครึ่งตัว พื้นหลังโล่ง ใช้หน้าแรกและหน้ารู้จักพี่ที", ratio: "4 / 4.5", group: "landing" },
  { key: "about_why_1", label: "รู้จักพี่ที — รูปพี่ทีกำลังสอนหน้าห้อง", hint: "แนวนอน 4:3 · เห็นกระดานและนักเรียนในเฟรม", ratio: "4 / 3", group: "about" },
  { key: "about_why_2", label: "รู้จักพี่ที — ภาพหน้าจอระบบทำข้อสอบ", hint: "แนวนอน 4:3 · ถ่ายจากจอจริง พร้อมธงสีรายข้อ", ratio: "4 / 3", group: "about" },
  { key: "about_why_3", label: "รู้จักพี่ที — รูปหมู่นักเรียนรุ่นที่ผ่านมา", hint: "แนวนอน 4:3 · ขออนุญาตผู้ปกครองก่อนใช้ภาพเด็ก", ratio: "4 / 3", group: "about" },
  { key: "course_exam-pack", label: "คอร์ส — ชุดข้อสอบเสมือนจริง", hint: "แนวนอน 16:9 · ภาพปกหน้ารายละเอียดคอร์ส", ratio: "16 / 9", group: "courses" },
  { key: "course_full-course", label: "คอร์ส — คอร์สติวเข้า จภ. เต็มรูปแบบ", hint: "แนวนอน 16:9 · ภาพปกหน้ารายละเอียดคอร์ส", ratio: "16 / 9", group: "courses" },
  { key: "course_course-plus-packs", label: "คอร์ส — คอร์ส + คลังข้อสอบทั้งหมด", hint: "แนวนอน 16:9 · ภาพปกหน้ารายละเอียดคอร์ส", ratio: "16 / 9", group: "courses" },
];

export const SITE_ASSET_KEYS = SITE_ASSET_SLOTS.map((s) => s.key);

export function isSiteAssetKey(key: string): boolean {
  return SITE_ASSET_KEYS.includes(key);
}
