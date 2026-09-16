const thb = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

/** 490000 satang -> "4,900 บาท". */
export function formatBaht(satang: number): string {
  return `${thb.format(Math.round(satang / 100))} บาท`;
}

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  calendar: "buddhist",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const thaiDateShort = new Intl.DateTimeFormat("th-TH", {
  calendar: "buddhist",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Bangkok",
});
const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  calendar: "buddhist",
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

export const formatThaiDate = (iso: string | Date) => thaiDate.format(new Date(iso));
export const formatThaiDateShort = (iso: string | Date) => thaiDateShort.format(new Date(iso));
export const formatThaiDateTime = (iso: string | Date) => thaiDateTime.format(new Date(iso));

/** ISO instant -> Bangkok calendar day as YYYY-MM-DD for <input type="date">. */
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
export const toDay = (iso: string) => isoDay.format(new Date(iso));

/** Seconds -> "2:15:00" above an hour, "48:12" below. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const formatNumber = (n: number) => thb.format(n);
