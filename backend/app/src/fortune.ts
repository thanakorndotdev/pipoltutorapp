/**
 * Fortune-telling engine (ดูดวงแนวทางการสอบ).
 *
 * Two layers. The rule-based layer is deterministic: the same input always
 * yields the same facts, built on the Thai convention of the birth weekday
 * (with Wednesday split into day/night) plus the birth-hour band and a digit
 * sum of the date of birth. The AI layer (Cloudflare Workers AI, see
 * generateFortune) writes the prose on top of those facts so every reading
 * reads differently; when it is unavailable the rule-based copy below is
 * the reading. The client has not supplied their own rules yet, so the
 * tables are the placeholder ruleset; swap the tables, keep the shape.
 *
 * Entertainment only — every reading ends by pointing back at the mock exam.
 */

import { CloudflareAiError, aiModel, cloudflareAiConfigured, runJson } from "./ai/cloudflare";
import { PCSHS_CAMPUSES, type PcshsCampusCode } from "./campuses";

export type FortuneInput = {
  name: string;
  /** ISO date, YYYY-MM-DD. */
  dob: string;
  /** HH:MM (24h) or null when the student does not know. */
  birthTime: string | null;
  campus: PcshsCampusCode;
  question: string;
  /** Title of the fortune product (topic) bought; absent on readings from before topics. */
  topic?: string;
};

export type FortuneResult = {
  version: 2;
  /** "ai" when Cloudflare Workers AI wrote the prose; "rules" for the static tables. */
  source: "ai" | "rules";
  /** Model id when source is "ai". */
  model?: string;
  birthDay: { key: DayKey; label: string; color: string; planet: string };
  timeBand: { key: TimeBandKey; label: string } | null;
  sections: { study: string; timing: string; caution: string };
  lucky: { numbers: number[]; color: string; item: string };
  answer: { topic: AnswerTopic; text: string };
  schedule: { day: string; focus: string }[];
  closing: string;
  generatedAt: string;
};

type DayKey = "sun" | "mon" | "tue" | "wed" | "wed_night" | "thu" | "fri" | "sat";
type TimeBandKey = "dawn" | "morning" | "afternoon" | "evening" | "night";
type AnswerTopic = "subject_order" | "best_time" | "time_pressure" | "rest" | "math" | "science" | "thai" | "english" | "confidence" | "general";

type DayProfile = {
  label: string;
  planet: string;
  color: string;
  luckyBase: number;
  item: string;
  study: string;
  caution: string;
  /** Subject the profile leans on, used to seed the weekly plan. */
  strong: string;
  weak: string;
};

const DAYS: Record<DayKey, DayProfile> = {
  sun: {
    label: "วันอาทิตย์",
    planet: "พระอาทิตย์",
    color: "แดง",
    luckyBase: 6,
    item: "ปากกาสีแดงสำหรับติ๊กข้อที่ยังไม่มั่นใจ",
    study:
      "น้องเป็นคนเรียนรู้ได้ไวเมื่อมีเป้าหมายชัด ๆ อยู่ตรงหน้า ดาวประจำวันให้พลังในการเริ่มต้นสูง แต่แผ่วง่ายเมื่อทำอะไรซ้ำ ๆ นาน ๆ วิธีที่เข้ากับน้องคือแบ่งเนื้อหาเป็นก้อนสั้น ๆ ตั้งเป้าเป็นจำนวนข้อต่อวัน ไม่ใช่จำนวนชั่วโมง แล้วขีดฆ่าเมื่อทำเสร็จ ความรู้สึก “ชนะ” เล็ก ๆ ทุกวันจะพาไปถึงวันสอบได้แบบไม่หมดแรงกลางทาง",
    caution:
      "จุดที่ต้องระวังคือความมั่นใจล้ำหน้าความรอบคอบ น้องมักอ่านโจทย์เร็วแล้วตอบทันที ข้อที่พลาดจึงมักเป็นข้อที่ “รู้อยู่แล้ว” มากกว่าข้อยาก ให้ฝึกอ่านโจทย์สองรอบก่อนตอบ และอย่าเทียบตัวเองกับเพื่อนบ่อยเกินไป — ดวงน้องแพ้ทางความกดดันจากภายนอกมากกว่าจากตัวโจทย์",
    strong: "คณิตศาสตร์",
    weak: "ภาษาไทย",
  },
  mon: {
    label: "วันจันทร์",
    planet: "พระจันทร์",
    color: "เหลือง",
    luckyBase: 15,
    item: "สมุดโน้ตเล่มเล็กจดสูตรที่ผิดซ้ำ",
    study:
      "ดาวประจำวันให้ความจำและความละเอียดอ่อนกับน้อง น้องจำได้ดีเมื่อได้ “เห็น” มากกว่า “ฟัง” จึงเหมาะกับการสรุปเป็นแผนผัง ตาราง หรือรูปวาดด้วยมือตัวเอง อ่านหนังสือคนเดียวในที่เงียบจะได้ผลดีกว่าติวเป็นกลุ่ม แต่ควรมีคนให้ถามได้เมื่อค้าง เพราะน้องมักเก็บข้อสงสัยไว้เงียบ ๆ จนกลายเป็นช่องโหว่ในวันสอบ",
    caution:
      "อารมณ์มีผลกับผลการอ่านของน้องมากกว่าคนวันอื่น วันไหนใจไม่นิ่ง ให้เปลี่ยนไปทำโจทย์ง่าย ๆ ที่เคยทำได้แทนการฝืนอ่านบทใหม่ และระวังการ “ทวนแต่บทที่ชอบ” — ดวงน้องมีแนวโน้มเลี่ยงวิชาที่ไม่ถนัดโดยไม่รู้ตัว ให้ตั้งเวลาให้วิชาที่ไม่ชอบก่อนวิชาที่ชอบเสมอ",
    strong: "ภาษาไทย",
    weak: "คณิตศาสตร์",
  },
  tue: {
    label: "วันอังคาร",
    planet: "พระอังคาร",
    color: "ชมพู",
    luckyBase: 8,
    item: "นาฬิกาจับเวลาตอนทำโจทย์",
    study:
      "น้องมีพลังแบบนักสู้ ยิ่งโจทย์ยากยิ่งอยากเอาชนะ ซึ่งเป็นข้อได้เปรียบใหญ่ในสนามสอบที่ข้อสอบวัดการคิดวิเคราะห์ วิธีที่เข้ากับน้องคือทำข้อสอบจับเวลาบ่อย ๆ แล้ววิเคราะห์ข้อผิดทีละข้อว่าผิดเพราะไม่รู้ หรือผิดเพราะรีบ อย่าอ่านทฤษฎีนานเกินสามสิบนาทีโดยไม่ได้ลงมือทำโจทย์ เพราะพลังของน้องอยู่ที่การลงมือ",
    caution:
      "ความใจร้อนคือศัตรูตัวจริง ดวงน้องมักเสียคะแนนจากการข้ามขั้นตอน ลืมตรวจหน่วย หรือลืมกลับไปทำข้อที่ข้ามไว้ ให้จัดระบบการ “ปักธง” ข้อที่ยังไม่แน่ใจตั้งแต่ตอนซ้อม และเผื่อเวลาห้านาทีสุดท้ายไว้ตรวจเสมอ นอกจากนี้ระวังการอดนอนก่อนสอบ พลังที่มากของน้องจะกลายเป็นความฟุ้งซ่านทันทีเมื่อพักไม่พอ",
    strong: "วิทยาศาสตร์",
    weak: "ภาษาอังกฤษ",
  },
  wed: {
    label: "วันพุธ (กลางวัน)",
    planet: "พระพุธ",
    color: "เขียว",
    luckyBase: 17,
    item: "ไฮไลต์สีเขียวขีดคำสำคัญในโจทย์",
    study:
      "ดาวประจำวันให้ทักษะการสื่อสารและการเชื่อมโยง น้องเข้าใจเรื่องยากได้เร็วเมื่อได้อธิบายให้คนอื่นฟัง วิธีที่เข้ากับน้องคือติวให้เพื่อนหรือเล่าให้ผู้ปกครองฟังหลังอ่านจบแต่ละบท ถ้าเล่าไม่ได้แปลว่ายังไม่เข้าใจจริง น้องเหมาะกับการสลับวิชาทุกหนึ่งชั่วโมง เพราะสมองน้องตื่นตัวกับความหลากหลายมากกว่าการเจาะวิชาเดียวทั้งวัน",
    caution:
      "จุดอ่อนคือความ “กว้างแต่ไม่ลึก” น้องรู้หลายเรื่องแต่บางเรื่องรู้แค่ผิว ๆ ข้อสอบเจาะลึกจะจับได้ทันที ให้เลือกสองบทที่ออกสอบบ่อยที่สุดแล้วทำโจทย์ให้ถึงระดับยากจริง ๆ ระวังเรื่องสมาธิสั้นจากมือถือ ดวงน้องเสียเวลากับการ “แค่เช็กแป๊บเดียว” มากกว่าที่คิด",
    strong: "ภาษาอังกฤษ",
    weak: "วิทยาศาสตร์",
  },
  wed_night: {
    label: "วันพุธกลางคืน",
    planet: "พระราหู",
    color: "ดำ / เทาเข้ม",
    luckyBase: 12,
    item: "โจทย์เก่าย้อนหลังที่ทำผิดไว้",
    study:
      "ราหูให้ความสามารถในการมองต่างมุมและหาทางลัดที่คนอื่นมองไม่เห็น น้องมักได้คำตอบด้วยวิธีที่ไม่เหมือนในเฉลย ซึ่งดีมากในข้อสอบแนวคิดวิเคราะห์ วิธีที่เข้ากับน้องคือทำโจทย์ที่ไม่มีตัวเลือกก่อน แล้วค่อยดูตัวเลือก จะได้ไม่ถูกตัวเลือกลวงหลอก และเรียนตอนกลางคืนได้ผลดีกว่าเช้า แต่ต้องกำหนดเวลานอนให้ชัด",
    caution:
      "ดวงราหูมีเรื่อง “ความคิดวนซ้ำ” น้องมักย้อนไปแก้คำตอบที่ถูกอยู่แล้วให้ผิด กติกาสำหรับน้องคือ ถ้าไม่มีหลักฐานชัดว่าผิด ห้ามเปลี่ยนคำตอบแรก ระวังการเปรียบเทียบตัวเองกับคนอื่นในโซเชียลช่วงใกล้สอบ ให้เก็บพลังไว้กับโจทย์ตรงหน้าเท่านั้น",
    strong: "คณิตศาสตร์",
    weak: "ภาษาไทย",
  },
  thu: {
    label: "วันพฤหัสบดี",
    planet: "พระพฤหัสบดี",
    color: "ส้ม",
    luckyBase: 19,
    item: "หนังสือสรุปเล่มเดียวที่อ่านซ้ำได้ครบ",
    study:
      "ดาวครูให้ความเป็นระบบและความอดทน น้องเป็นคนเรียนแบบค่อย ๆ สะสม ไม่หวือหวาแต่มั่นคง ซึ่งเป็นแบบที่คะแนนขึ้นจริงเมื่อถึงวันสอบ วิธีที่เข้ากับน้องคือทำตารางอ่านรายสัปดาห์แล้วทำตามให้ครบ ไม่ต้องมากในแต่ละวัน แต่ต้องไม่ขาด และให้อ่านบทที่ยากในช่วงเช้าที่สมองยังสด",
    caution:
      "จุดที่ต้องระวังคือความ “ช้าแต่ชัวร์” ที่กลายเป็นช้าเกินไปในห้องสอบ น้องมักใช้เวลากับข้อแรก ๆ มากจนข้อท้ายไม่ได้ทำ ให้ฝึกกำหนดเวลาต่อข้อและกล้าข้ามข้อที่ติดเกินสองนาที อีกเรื่องคือน้องอาจเชื่อหนังสือหรือครูจนไม่กล้าคิดต่าง ในข้อสอบแนวคิดวิเคราะห์บางข้อต้องกล้าตัดสินใจเอง",
    strong: "วิทยาศาสตร์",
    weak: "คณิตศาสตร์",
  },
  fri: {
    label: "วันศุกร์",
    planet: "พระศุกร์",
    color: "ฟ้า",
    luckyBase: 21,
    item: "โต๊ะอ่านหนังสือที่จัดใหม่ให้โล่ง",
    study:
      "ดาวประจำวันให้ความละเอียดด้านภาษาและศิลปะการจับใจความ น้องอ่านโจทย์ยาว ๆ แล้วจับประเด็นได้ดี ซึ่งช่วยมากทั้งวิชาไทย อังกฤษ และโจทย์ปัญหาคณิต วิธีที่เข้ากับน้องคือทำให้บรรยากาศการอ่านน่าอยู่ — โต๊ะสะอาด แสงพอ เพลงเบา ๆ ถ้าจำเป็น สมองน้องทำงานดีเมื่อรู้สึกสบาย ไม่ใช่เมื่อถูกบีบ",
    caution:
      "ความสบายกลายเป็นความเฉื่อยได้ง่าย ดวงน้องมีแนวโน้มเลื่อนไปก่อนแล้วค่อยเร่งตอนใกล้สอบ ให้มีเพื่อนหรือผู้ปกครองช่วยเช็กความคืบหน้าทุกสัปดาห์ และระวังการติดอยู่กับข้อที่ “สวย” แต่ไม่ออกสอบ ให้ยึดแนวข้อสอบเก่าเป็นหลัก",
    strong: "ภาษาไทย",
    weak: "วิทยาศาสตร์",
  },
  sat: {
    label: "วันเสาร์",
    planet: "พระเสาร์",
    color: "ม่วง",
    luckyBase: 10,
    item: "ตารางอ่านหนังสือติดผนังที่เห็นทุกวัน",
    study:
      "ดาวประจำวันให้ความอดทนและวินัยสูงที่สุดในเจ็ดวัน น้องทำอะไรทำจริง ทนกับโจทย์ยาก ๆ ได้นานโดยไม่ท้อ ซึ่งเป็นคุณสมบัติที่หายากมากในวัยนี้ วิธีที่เข้ากับน้องคือเจาะลึกทีละบทจนถึงระดับยากสุด แล้วค่อยขยับไปบทถัดไป ไม่ต้องเรียนกว้างเท่าคนอื่น แต่ทุกบทที่ผ่านต้องเป็นบทที่ทำได้ทุกระดับ",
    caution:
      "จุดที่ต้องระวังคือความเครียดสะสมและการโทษตัวเองเมื่อคะแนนซ้อมไม่ขึ้น ดวงน้องเก็บทุกอย่างไว้ข้างในจนอาจ “หมดไฟ” เงียบ ๆ ก่อนสอบ ให้กำหนดวันพักในตารางให้ชัดเจนเท่ากับวันอ่าน และเมื่อทำโจทย์ผิด ให้จดว่าเรียนรู้อะไร ไม่ใช่จดว่าผิดกี่ข้อ",
    strong: "คณิตศาสตร์",
    weak: "ภาษาอังกฤษ",
  },
};

const TIME_BANDS: Record<TimeBandKey, { label: string; range: [number, number]; timing: string }> = {
  dawn: {
    label: "ช่วงรุ่งสาง (04:00–07:59)",
    range: [4, 8],
    timing:
      "น้องเกิดในช่วงที่ดวงอาทิตย์กำลังขึ้น สมองของน้องจะสดที่สุดในช่วงเช้าก่อนไปโรงเรียน ลองตื่นเร็วขึ้นสามสิบนาทีเพื่อทำโจทย์คณิตหรือวิทย์ที่ต้องคิดหนัก ส่วนช่วงเย็นให้ใช้ทบทวนสิ่งที่เรียนมาแล้วหรืออ่านวิชาที่ใช้ความจำ ไม่เหมาะกับการเริ่มบทใหม่ตอนดึก และช่วงสองสัปดาห์สุดท้ายก่อนสอบ ให้เลื่อนเวลานอนให้เร็วขึ้นเพื่อล็อกจังหวะนี้ไว้",
  },
  morning: {
    label: "ช่วงเช้า (08:00–11:59)",
    range: [8, 12],
    timing:
      "จังหวะที่ดีที่สุดของน้องคือช่วงสายถึงเที่ยง ซึ่งตรงกับเวลาสอบจริงพอดี นี่คือข้อได้เปรียบ ให้ซ้อมทำข้อสอบชุดเต็มในวันหยุดช่วง 09:00–11:00 ให้ร่างกายชินกับการคิดหนักในเวลานั้น ช่วงบ่ายหลังเลิกเรียนพลังจะตกลง ให้ทำงานเบา ๆ เช่น จดสรุปหรือทำโจทย์ที่เคยทำแล้ว และหลังสองทุ่มควรปิดหนังสือ เพราะดวงน้องอ่านดึกแล้วจำไม่อยู่",
  },
  afternoon: {
    label: "ช่วงบ่าย (12:00–15:59)",
    range: [12, 16],
    timing:
      "พลังของน้องมาช้าแต่มาแรง ช่วงเช้ามักยังไม่ตื่นตัวเต็มที่ แต่หลังเที่ยงจนถึงเย็นคือเวลาทอง ให้จัดโจทย์ยากไว้ตอนบ่ายวันหยุดและช่วงหลังเลิกเรียนทันที ก่อนที่จะเข้าสู่ช่วงพักเย็น ข้อควรรู้คือเวลาสอบจริงเป็นช่วงเช้า น้องจึงต้อง “ปรับนาฬิกา” ในเดือนสุดท้าย ด้วยการซ้อมทำข้อสอบชุดเต็มในช่วงเช้าอย่างน้อยสัปดาห์ละครั้ง",
  },
  evening: {
    label: "ช่วงเย็น (16:00–19:59)",
    range: [16, 20],
    timing:
      "ช่วงหลังพระอาทิตย์ตกคือเวลาที่สมองน้องเปิดกว้างที่สุด เหมาะกับการเรียนบทใหม่หรือทำความเข้าใจเรื่องที่ยังงง ให้จัดช่วง 17:00–19:30 เป็นช่วงเรียนหลักของวัน โดยกินอาหารเย็นให้เรียบร้อยก่อนหรือหลังช่วงนี้ ไม่ใช่ตรงกลาง ช่วงเช้าให้ใช้ทบทวนสั้น ๆ สิบห้านาทีก่อนไปโรงเรียน และควรซ้อมข้อสอบเต็มตอนเช้าบ้างเพื่อให้ร่างกายชินกับเวลาสอบจริง",
  },
  night: {
    label: "ช่วงกลางคืน (20:00–03:59)",
    range: [20, 28],
    timing:
      "ดวงน้องเป็นคนกลางคืนโดยธรรมชาติ ยิ่งดึกยิ่งคิดออก แต่ในวัยนี้การนอนสำคัญกับความจำมากกว่าจำนวนชั่วโมงที่อ่าน กติกาคือใช้ช่วง 19:30–21:30 เป็นช่วงเรียนหลัก แล้วปิดไฟก่อนสี่ทุ่มเสมอ อย่าลากไปถึงเที่ยงคืนแม้จะรู้สึกว่ากำลังลื่น ช่วงเช้าให้แค่ทวนโน้ตสั้น ๆ และในเดือนสุดท้ายต้องซ้อมข้อสอบตอนเช้าทุกสัปดาห์ เพราะห้องสอบไม่รอให้น้องตื่นเต็มที่",
  },
};

/** Timing text when the birth hour is unknown — keyed on the weekday instead. */
const TIMING_BY_DAY: Record<DayKey, string> = {
  sun: "แม้ไม่ทราบเวลาเกิด ดาวอาทิตย์ก็บอกว่าน้องเป็นคนตอนเช้า ให้อ่านบทยากช่วง 06:30–07:30 ก่อนไปโรงเรียน และซ้อมข้อสอบชุดเต็มในเช้าวันหยุดให้ตรงกับเวลาสอบจริง ช่วงค่ำใช้แค่ทวนโน้ตแล้วเข้านอนก่อนสี่ทุ่ม",
  mon: "ดาวจันทร์ให้พลังช่วงค่ำ ช่วง 19:00–21:00 คือเวลาที่ความจำน้องทำงานดีที่สุด เหมาะกับวิชาที่ต้องจำ เช่น ไทย วิทย์ชีวะ ส่วนโจทย์คณิตให้ทำช่วงเย็นหลังเลิกเรียนขณะที่ยังตื่นตัว และควรซ้อมข้อสอบเต็มตอนเช้าบ้างเพื่อปรับจังหวะ",
  tue: "ดาวอังคารให้พลังพุ่งช่วงบ่ายถึงเย็น ให้จัดโจทย์จับเวลาไว้ช่วง 16:30–18:00 หลังเลิกเรียน แล้วพักจริง ๆ หลังอาหารเย็น ไม่ต้องยืดถึงดึก เพราะพลังที่เหลือจะกลายเป็นความฟุ้งซ่าน เช้าวันหยุดให้ซ้อมข้อสอบชุดเต็มสัปดาห์ละครั้ง",
  wed: "ดาวพุธให้สมองที่ตื่นตัวตลอดวันแต่สมาธิสั้น ให้แบ่งการอ่านเป็นช่วงละ 45 นาที พัก 10 นาที ตั้งแต่ 17:00 ถึง 20:00 สลับวิชาทุกช่วง และซ้อมข้อสอบเต็มในเช้าวันหยุดเพื่อฝึกอยู่กับโจทย์ต่อเนื่องนาน ๆ",
  wed_night: "ราหูให้พลังช่วงดึก แต่กติกาสำหรับวัยนี้คือเรียนหลัก 19:30–21:30 แล้วปิดไฟก่อนสี่ทุ่ม ห้ามลากไปเที่ยงคืน ช่วงเช้าให้ทวนโน้ตสั้น ๆ และเดือนสุดท้ายต้องซ้อมข้อสอบตอนเช้าทุกสัปดาห์",
  thu: "ดาวพฤหัสบดีชอบความสม่ำเสมอมากกว่าเวลาใดเวลาหนึ่ง ให้เลือกช่วงเวลาเดิมทุกวัน เช่น 18:30–20:00 แล้วทำตามให้ครบ 6 วันต่อสัปดาห์ บทยากไว้เช้าวันหยุด ซึ่งตรงกับเวลาสอบจริง",
  fri: "ดาวศุกร์ให้พลังช่วงเย็นที่บรรยากาศสบาย ให้จัดโต๊ะให้น่านั่งแล้วอ่านช่วง 17:30–19:30 ทุกวัน อย่าอ่านบนเตียง และซ้อมข้อสอบเต็มในเช้าวันหยุดอย่างน้อยสองครั้งต่อเดือน",
  sat: "ดาวเสาร์ให้ความอดทนที่ยาวนาน ช่วงเช้าวันหยุด 08:00–11:00 คือช่วงที่น้องเจาะลึกได้ดีที่สุดและตรงกับเวลาสอบจริง วันธรรมดาอ่านช่วง 18:00–20:00 แล้วพัก อย่าลากยาวจนเครียดสะสม",
};

const ANSWERS: Record<AnswerTopic, string> = {
  subject_order:
    "เรียงลำดับตามดวงของน้อง: เริ่มจากวิชาที่ดาวประจำวันบอกว่าเป็นจุดอ่อนก่อน ({weak}) เพราะเป็นวิชาที่คะแนนขึ้นได้มากที่สุดต่อชั่วโมงที่ลงไป ตามด้วยวิชาถนัด ({strong}) เพื่อรักษาความมั่นใจ แล้วปิดท้ายแต่ละสัปดาห์ด้วยข้อสอบรวมชุดหนึ่ง ข้อสอบเข้า จภ. ให้น้ำหนักคณิตกับวิทย์มาก ดังนั้นไม่ว่าจะเรียงอย่างไร สองวิชานี้ต้องได้อย่างน้อยครึ่งหนึ่งของเวลาอ่านทั้งหมด",
  best_time:
    "{timingShort} ให้ยึดช่วงนั้นเป็นช่วงเรียนหลัก ส่วนช่วงอื่นใช้ทำงานเบา ๆ เช่น ทวนโน้ตหรือทำโจทย์ที่เคยทำแล้ว สิ่งสำคัญกว่าช่วงเวลาคือความสม่ำเสมอ — ดวงบอกว่าน้องได้เปรียบเมื่อร่างกายรู้ล่วงหน้าว่าถึงเวลาต้องคิดหนัก",
  time_pressure:
    "ดวงของน้องบอกว่าปัญหาไม่ได้อยู่ที่ความเร็ว แต่อยู่ที่การไม่ยอมปล่อยข้อที่ติด กติกาสามข้อ: หนึ่ง — ข้อไหนอ่านโจทย์แล้วไม่เห็นทางภายในสองนาที ปักธงแล้วข้าม สอง — ทำข้อที่มั่นใจให้ครบทั้งชุดก่อน ค่อยย้อนกลับ สาม — ซ้อมด้วยเวลาที่สั้นกว่าของจริงสิบเปอร์เซ็นต์ เพื่อให้วันสอบรู้สึกว่ามีเวลาเหลือ ทำแบบนี้สามชุดติดกันแล้วน้องจะเห็นความต่าง",
  rest:
    "ดาวประจำวันของน้องบอกว่าน้องเป็นคนที่ “ยิ่งฝืนยิ่งเสีย” ให้พักทุก 45–50 นาทีของการอ่าน ครั้งละสิบนาทีแบบลุกจากโต๊ะจริง ๆ ไม่ใช่เปลี่ยนไปดูมือถือ และให้มีวันพักเต็มวันสัปดาห์ละหนึ่งวัน ตารางที่ไม่มีวันพักคือตารางที่ทำไม่ได้จริง ช่วงสัปดาห์สุดท้ายก่อนสอบให้ลดปริมาณลงครึ่งหนึ่ง ความรู้ที่มีจะถูกเรียกใช้ได้ดีกว่าเมื่อสมองไม่ล้า",
  math:
    "คณิตศาสตร์กับดวงของน้องมีเรื่อง “ทำได้แต่ไม่ทัน” หรือ “เข้าใจแต่พลาดตอนคิดเลข” มากกว่าเรื่องไม่เข้าใจ วิธีแก้คือหยุดอ่านเนื้อหาเพิ่ม แล้วทำโจทย์บทเดิมซ้ำจนถึงระดับที่ทำได้โดยไม่ต้องคิดนาน โฟกัสบทที่ออกบ่อย: จำนวนและการดำเนินการ เศษส่วน ร้อยละ อัตราส่วน และเรขาคณิตเบื้องต้น จดข้อที่ผิดไว้ในสมุดเล่มเดียว แล้วทำซ้ำเฉพาะข้อเหล่านั้นทุกสามวัน คะแนนจะขยับภายในสองสัปดาห์",
  science:
    "วิทยาศาสตร์สำหรับดวงน้องคือวิชาที่ต้อง “เห็นภาพ” ไม่ใช่ท่องจำ ให้วาดรูปประกอบทุกครั้งที่อ่านเรื่องใหม่ เช่น วงจรไฟฟ้า ระบบร่างกาย หรือการเปลี่ยนสถานะ ข้อสอบเข้า จภ. ชอบถามแบบให้วิเคราะห์จากข้อมูลหรือตาราง ให้ฝึกอ่านกราฟและตารางทุกวันวันละสองข้อ และอย่าลืมบทที่เด็กส่วนใหญ่ข้าม เช่น แรงและการเคลื่อนที่ ซึ่งออกสอบเกือบทุกปี",
  thai: "ภาษาไทยกับดวงน้องเป็นเรื่องของ “ความละเอียด” มากกว่าความรู้ ให้ฝึกอ่านจับใจความจากบทความสั้น ๆ วันละหนึ่งบทแล้วสรุปเป็นประโยคเดียว ส่วนหลักภาษาให้เน้นเรื่องที่ออกซ้ำทุกปี: ชนิดของคำ ประโยค คำราชาศัพท์ และการสะกดคำ ทำโจทย์แล้วอ่านเฉลยทุกข้อแม้ข้อที่ถูก เพราะข้อที่เดาถูกคือข้อที่จะผิดในวันจริง",
  english:
    "ภาษาอังกฤษสำหรับดวงน้องขึ้นอยู่กับความสม่ำเสมอมากกว่าวิชาอื่น ให้ท่องศัพท์วันละสิบคำแบบใช้ในประโยค ไม่ใช่ท่องเป็นรายการ และอ่านบทความสั้นภาษาอังกฤษวันละหนึ่งเรื่อง ข้อสอบเน้นการอ่านและไวยากรณ์พื้นฐาน เช่น tense, subject-verb agreement และคำเชื่อม ทำโจทย์แนวเดิมซ้ำจนจำรูปแบบได้ คะแนนจะขึ้นเป็นขั้นบันไดหลังสัปดาห์ที่สาม",
  confidence:
    "ดวงน้องบอกว่าความกลัวมาจากการไม่รู้ว่าตัวเองอยู่ตรงไหน ไม่ใช่จากความไม่รู้เนื้อหา วิธีแก้ที่ตรงที่สุดคือทำข้อสอบเสมือนจริงหนึ่งชุดโดยไม่ต้องเตรียมตัว แล้วดูรายงานรายบท ตัวเลขที่เห็นจะบอกว่าต้องทำอะไรต่อ และความกลัวที่ไม่มีชื่อจะกลายเป็นงานที่มีรายการ ทุกครั้งที่คะแนนซ้อมขึ้นแม้แค่สองข้อ ให้จดไว้ ดวงน้องเติบโตจากหลักฐานเล็ก ๆ แบบนี้",
  general:
    "ดาวประจำวันเกิดของน้องตอบคำถามนี้ว่า สิ่งที่น้องกังวลอยู่ไม่ใช่เรื่องที่แก้ด้วยการอ่านให้มากขึ้น แต่แก้ด้วยการอ่านให้ตรงขึ้น ให้กลับไปดูข้อสอบเก่าหรือข้อสอบเสมือนจริงชุดล่าสุด ดูว่าผิดบทไหนซ้ำ ๆ แล้วเอาบทนั้นเป็นเป้าหมายของสัปดาห์นี้เพียงบทเดียว เมื่อทำได้แล้วค่อยขยับเป้า ดวงน้องชอบเป้าที่ชัดและใกล้มากกว่าเป้าใหญ่ที่ไกล",
};

const TOPIC_RULES: [AnswerTopic, RegExp][] = [
  ["time_pressure", /ไม่ทัน|หมดเวลา|ทำช้า|เวลาไม่พอ|ช้าเกิน/],
  ["best_time", /ช่วงไหน|เวลาไหน|ตอนไหน.*(อ่าน|เรียน|สมอง)|สมองแล่น|กี่โมง/],
  ["rest", /พัก|เหนื่อย|ล้า|หมดแรง|นอน/],
  ["subject_order", /วิชาไหน(ก่อน)?|เรียงวิชา|อ่านอะไรก่อน|เริ่มจาก/],
  ["math", /คณิต|เลข|math/i],
  ["science", /วิทย์|วิทยาศาสตร์|science/i],
  ["thai", /ภาษาไทย|วิชาไทย/],
  ["english", /อังกฤษ|english|ศัพท์/i],
  ["confidence", /กลัว|กังวล|เครียด|ไม่มั่นใจ|ท้อ|ไม่ขึ้น/],
];

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const SUBJECTS = ["คณิตศาสตร์", "วิทยาศาสตร์", "ภาษาไทย", "ภาษาอังกฤษ"];

function parseDate(iso: string): { y: number; m: number; d: number; weekday: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return { y, m: mo, d, weekday: date.getUTCDay() };
}

function parseHour(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h;
}

/** Thai convention: Wednesday after sunset (18:00) until dawn (06:00) is ราหู. */
function dayKey(weekday: number, hour: number | null): DayKey {
  const keys: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const key = keys[weekday];
  if (key === "wed" && hour !== null && (hour >= 18 || hour < 6)) return "wed_night";
  return key;
}

function timeBand(hour: number | null): TimeBandKey | null {
  if (hour === null) return null;
  const h = hour < 4 ? hour + 24 : hour;
  for (const [key, band] of Object.entries(TIME_BANDS) as [TimeBandKey, (typeof TIME_BANDS)[TimeBandKey]][]) {
    if (h >= band.range[0] && h < band.range[1]) return key;
  }
  return "night";
}

/** Digit-sum numerology reduced to 1–9, plus a second number from the day profile. */
function luckyNumbers(dob: { y: number; m: number; d: number }, base: number): number[] {
  const digits = `${dob.y}${dob.m}${dob.d}`.split("").map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9) sum = String(sum).split("").map(Number).reduce((a, b) => a + b, 0);
  const second = ((base + dob.d) % 9) + 1;
  const third = ((dob.d * dob.m) % 45) + 1;
  return Array.from(new Set([sum, second, third]));
}

function topicFor(question: string): AnswerTopic {
  for (const [topic, re] of TOPIC_RULES) if (re.test(question)) return topic;
  return "general";
}

function schedule(day: DayProfile, dob: { d: number }): { day: string; focus: string }[] {
  // Rotate the four subjects so the weak one lands twice and the profile's
  // strong subject once; the offset keeps two students from getting the
  // exact same week.
  const offset = dob.d % 4;
  const order = [day.weak, ...SUBJECTS.filter((s) => s !== day.weak && s !== day.strong), day.strong, day.weak];
  const rotated = order.slice(offset).concat(order.slice(0, offset));
  const week = THAI_DAYS.slice(1).concat(THAI_DAYS[0]); // จันทร์..อาทิตย์
  return week.map((name, i) => {
    if (i === 5) return { day: name, focus: "ข้อสอบเสมือนจริง 1 ชุด + ตรวจรายงานรายบท" };
    if (i === 6) return { day: name, focus: "พักเต็มวัน / ทวนสมุดข้อผิดสิบห้านาที" };
    return { day: name, focus: rotated[i % rotated.length] };
  });
}

export function validateFortuneInput(input: FortuneInput): string | null {
  if (!parseDate(input.dob)) return "วันเกิดไม่ถูกต้อง";
  if (input.birthTime && parseHour(input.birthTime) === null) return "เวลาเกิดไม่ถูกต้อง";
  if (!PCSHS_CAMPUSES.some((c) => c.code === input.campus)) return "ไม่พบสนามสอบที่เลือก";
  return null;
}

export function computeFortune(input: FortuneInput, now = new Date()): FortuneResult {
  const dob = parseDate(input.dob);
  if (!dob) throw new Error("invalid dob");
  const hour = parseHour(input.birthTime);
  const key = dayKey(dob.weekday, hour);
  const day = DAYS[key];
  const band = timeBand(hour);
  const campus = PCSHS_CAMPUSES.find((c) => c.code === input.campus)?.label ?? "จภ.";
  const firstName = input.name.trim().replace(/^(ด\.ญ\.|ด\.ช\.|เด็กหญิง|เด็กชาย|นาย|นางสาว|น\.ส\.)\s*/, "").split(/\s+/)[0] || "น้อง";

  const timing = band ? TIME_BANDS[band].timing : TIMING_BY_DAY[key];
  const timingShort = band ? `น้องเกิด${TIME_BANDS[band].label} ดวงบอกว่าสมองน้องทำงานดีที่สุดในช่วงนั้นของวัน` : `ดาว${day.planet}บอกว่าน้องอ่านได้ดีในช่วงที่แนะนำไว้ด้านบน`;
  const topic = topicFor(input.question);
  const answer = ANSWERS[topic].replace("{weak}", day.weak).replace("{strong}", day.strong).replace("{timingShort}", timingShort);

  return {
    version: 2,
    source: "rules",
    birthDay: { key, label: day.label, color: day.color, planet: day.planet },
    timeBand: band ? { key: band, label: TIME_BANDS[band].label } : null,
    sections: {
      study: `${firstName}เกิด${day.label} มี${day.planet}เป็นดาวประจำตัว ${day.study}`,
      timing,
      caution: day.caution,
    },
    lucky: { numbers: luckyNumbers(dob, day.luckyBase), color: day.color, item: day.item },
    answer: { topic, text: answer },
    schedule: schedule(day, dob),
    closing: `ดวงบอกได้ว่าน้องเป็นคนแบบไหนและควรอ่านตอนไหน แต่สิ่งที่จะพา${firstName}เข้า${campus}ได้จริงคือจำนวนโจทย์ที่ทำและการกลับไปแก้จุดที่ผิดซ้ำ คำทำนายนี้มีไว้เพื่อความบันเทิงและช่วยจัดตาราง ไม่ใช่การพยากรณ์ผลสอบ`,
    generatedAt: now.toISOString(),
  };
}

/* ---------- AI layer ---------- */

/** What the model is asked to write; everything else stays rule-derived. */
type AiProse = {
  study: string;
  timing: string;
  caution: string;
  answer: string;
  schedule: string[];
  closing: string;
};

const AI_SCHEMA = {
  type: "object",
  properties: {
    study: { type: "string", description: "ด้านการเรียน 2-3 ประโยค" },
    timing: { type: "string", description: "ช่วงเวลาที่เหมาะกับการอ่านหนังสือ 2-3 ประโยค" },
    caution: { type: "string", description: "สิ่งที่ควรระวัง 2-3 ประโยค" },
    answer: { type: "string", description: "คำตอบต่อคำถามของน้อง 3-4 ประโยค" },
    schedule: {
      type: "array",
      description: "สิ่งที่ควรทำในแต่ละวัน จันทร์ถึงอาทิตย์ 7 รายการ รายการละไม่เกิน 12 คำ",
      items: { type: "string" },
      minItems: 7,
      maxItems: 7,
    },
    closing: { type: "string", description: "คำปิดท้าย 2 ประโยค" },
  },
  required: ["study", "timing", "caution", "answer", "schedule", "closing"],
} as const;

const SYSTEM_PROMPT = `คุณคือ "หมอดูพี่พิพล" หมอดูประจำเว็บติวสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย (จภ.)
ผู้อ่านคือนักเรียน ป.6 อายุ 11-12 ปี และผู้ปกครองที่นั่งอ่านด้วยกัน

กติกา:
- เขียนเป็นภาษาไทยทั้งหมด สุภาพ อบอุ่น เรียกผู้อ่านว่า "น้อง" ตามด้วยชื่อเล่นที่ให้มา
- อิงจากข้อมูลดวงที่ให้ (วันเกิด ดาวประจำตัว สี เลขนำโชค ช่วงเวลาเกิด วิชาที่เด่น/ควรเสริม) ห้ามแต่งข้อมูลดวงเพิ่ม
- ทุกส่วนต้องโยงกลับไปที่การฝึกทำข้อสอบ ทบทวนจุดที่ผิด และการพักผ่อนให้พอ
- ห้ามทำนายว่าจะสอบติดหรือไม่ติด ห้ามพูดถึงโชคร้าย อุบัติเหตุ ความเจ็บป่วย หรือเรื่องน่ากลัว
- ห้ามแนะนำวัตถุมงคล การบูชา หรือค่าใช้จ่ายใด ๆ
- ไม่ใช้ตัวเลขไทย ไม่ใช้อีโมจิ
- ตอบเป็น JSON ตาม schema เท่านั้น`;

function userPrompt(input: FortuneInput, rules: FortuneResult, firstName: string, campus: string): string {
  const day = DAYS[rules.birthDay.key];
  return [
    `ชื่อเล่น: ${firstName}`,
    `ตั้งใจสอบเข้า: ${campus}`,
    `วันเกิด: ${rules.birthDay.label} ดาวประจำตัว${rules.birthDay.planet} สีประจำวัน${rules.birthDay.color}`,
    rules.timeBand ? `ช่วงเวลาเกิด: ${rules.timeBand.label}` : "ช่วงเวลาเกิด: ไม่ทราบ",
    `เลขนำโชค: ${rules.lucky.numbers.join(", ")}`,
    `ของนำโชค: ${rules.lucky.item}`,
    `วิชาที่ดวงเด่น: ${day.strong}`,
    `วิชาที่ควรเสริม: ${day.weak}`,
    ...(input.topic ? [`หัวข้อที่น้องเลือก: ${input.topic}`] : []),
    `คำถามของน้อง: "${input.question}"`,
    "",
    "เขียนคำทำนายแนวทางการสอบตาม schema: study, timing, caution, answer (ตอบคำถามของน้องโดยตรง), schedule (7 วัน จันทร์ถึงอาทิตย์ วันเสาร์ให้ทำข้อสอบเสมือนจริง 1 ชุด วันอาทิตย์ให้พัก), closing",
  ].join("\n");
}

function cleanLine(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const text = v.replace(/\s+/g, " ").trim();
  return text.length >= 10 && text.length <= max ? text : null;
}

/** Reject anything that is not the shape and length the page expects. */
function validateProse(raw: unknown): AiProse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const study = cleanLine(r.study, 600);
  const timing = cleanLine(r.timing, 600);
  const caution = cleanLine(r.caution, 600);
  const answer = cleanLine(r.answer, 900);
  const closing = cleanLine(r.closing, 600);
  const schedule = Array.isArray(r.schedule) ? r.schedule.map((s) => cleanLine(s, 160)) : [];
  if (!study || !timing || !caution || !answer || !closing) return null;
  if (schedule.length !== 7 || schedule.some((s) => s === null)) return null;
  return { study, timing, caution, answer, closing, schedule: schedule as string[] };
}

export type GeneratedFortune = {
  result: FortuneResult;
  /**
   * False when the AI is configured but failed this time: the caller should
   * serve the rule-based result without storing it, so the next read retries.
   */
  persistent: boolean;
};

/**
 * The reading a paying student gets. Rule-based facts first, then the model
 * writes the prose around them. Never throws — a broken or unconfigured AI
 * degrades to the rule-based reading.
 */
export async function generateFortune(input: FortuneInput, now = new Date()): Promise<GeneratedFortune> {
  const rules = computeFortune(input, now);
  if (!cloudflareAiConfigured()) return { result: rules, persistent: true };

  const campus = PCSHS_CAMPUSES.find((c) => c.code === input.campus)?.label ?? "จภ.";
  const firstName = input.name.trim().replace(/^(ด\.ญ\.|ด\.ช\.|เด็กหญิง|เด็กชาย|นาย|นางสาว|น\.ส\.)\s*/, "").split(/\s+/)[0] || "น้อง";
  try {
    const raw = await runJson<AiProse>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(input, rules, firstName, campus) },
      ],
      AI_SCHEMA as unknown as Record<string, unknown>
    );
    const prose = validateProse(raw);
    if (!prose) {
      console.error("fortune ai: response failed validation", JSON.stringify(raw).slice(0, 400));
      return { result: rules, persistent: false };
    }
    return {
      persistent: true,
      result: {
        ...rules,
        source: "ai",
        model: aiModel(),
        sections: { study: prose.study, timing: prose.timing, caution: prose.caution },
        answer: { topic: rules.answer.topic, text: prose.answer },
        schedule: rules.schedule.map((s, i) => ({ day: s.day, focus: prose.schedule[i]! })),
        closing: prose.closing,
        generatedAt: now.toISOString(),
      },
    };
  } catch (error) {
    const detail = error instanceof CloudflareAiError ? `${error.status} ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error("fortune ai: falling back to rules:", detail);
    return { result: rules, persistent: false };
  }
}
