/**
 * The 18 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย (จภ.) campuses.
 * Mirror of backend/app/src/campuses.ts — the backend validates `code`
 * against its `pcshs_campus` enum, so keep the two lists identical.
 */
export const PCSHS_CAMPUSES = [
  { code: "chiang_rai", label: "จภ. เชียงราย" },
  { code: "phitsanulok", label: "จภ. พิษณุโลก" },
  { code: "lopburi", label: "จภ. ลพบุรี" },
  { code: "pathum_thani", label: "จภ. ปทุมธานี" },
  { code: "chonburi", label: "จภ. ชลบุรี" },
  { code: "phetchaburi", label: "จภ. เพชรบุรี" },
  { code: "nakhon_si_thammarat", label: "จภ. นครศรีธรรมราช" },
  { code: "trang", label: "จภ. ตรัง" },
  { code: "satun", label: "จภ. สตูล" },
  { code: "mukdahan", label: "จภ. มุกดาหาร" },
  { code: "loei", label: "จภ. เลย" },
  { code: "buriram", label: "จภ. บุรีรัมย์" },
  { code: "kalasin", label: "จภ. กาฬสินธุ์" },
  { code: "kanchanaburi", label: "จภ. กาญจนบุรี" },
  { code: "kamphaeng_phet", label: "จภ. กำแพงเพชร" },
  { code: "lampang", label: "จภ. ลำปาง" },
  { code: "sa_kaeo", label: "จภ. สระแก้ว" },
  { code: "suphan_buri", label: "จภ. สุพรรณบุรี" },
] as const;

export type PcshsCampusCode = (typeof PCSHS_CAMPUSES)[number]["code"];
