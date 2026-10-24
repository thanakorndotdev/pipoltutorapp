/**
 * The 18 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย (PCSHS, "จภ.") campuses.
 *
 * `code` is what the database stores (`pcshs_campus` enum) and what the API
 * accepts; `label` is the display string. The frontend keeps a copy of this
 * list in frontend/pipoltutor-app/lib/campuses.ts — change both together.
 */
export const PCSHS_CAMPUSES = [
  { code: "chiang_rai", label: "จภ. เชียงราย" },
  { code: "phitsanulok", label: "จภ. พิษณุโลก" },
  { code: "lopburi", label: "จภ. ลพบุรี" },
  { code: "loei", label: "จภ. เลย" },
  { code: "mukdahan", label: "จภ. มุกดาหาร" },
  { code: "buriram", label: "จภ. บุรีรัมย์" },
  { code: "pathum_thani", label: "จภ. ปทุมธานี" },
  { code: "chonburi", label: "จภ. ชลบุรี" },
  { code: "phetchaburi", label: "จภ. เพชรบุรี" },
  { code: "nakhon_si_thammarat", label: "จภ. นครศรีธรรมราช" },
  { code: "trang", label: "จภ. ตรัง" },
  { code: "satun", label: "จภ. สตูล" },
  { code: "lampang", label: "จภ. ลำปาง" },
  { code: "kamphaeng_phet", label: "จภ. กำแพงเพชร" },
  { code: "kalasin", label: "จภ. กาฬสินธุ์" },
  { code: "ubon_ratchathani", label: "จภ. อุบลราชธานี" },
  { code: "suphan_buri", label: "จภ. สุพรรณบุรี" },
  { code: "sa_kaeo", label: "จภ. สระแก้ว" },
] as const;

export type PcshsCampusCode = (typeof PCSHS_CAMPUSES)[number]["code"];

export const PCSHS_CAMPUS_CODES = PCSHS_CAMPUSES.map((c) => c.code) as [
  PcshsCampusCode,
  ...PcshsCampusCode[],
];
