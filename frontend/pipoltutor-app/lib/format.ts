const thb = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

/** 490000 satang -> "4,900 บาท". Display never shows satang. */
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

/** ISO instant -> "25 มกราคม 2569" (Buddhist era, Bangkok time). */
export function formatThaiDate(iso: string | Date): string {
  return thaiDate.format(typeof iso === "string" ? new Date(iso) : iso);
}

const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  calendar: "buddhist",
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

/** ISO instant -> "20 ส.ค. 68 21:14" (Buddhist era, Bangkok time). */
export function formatThaiDateTime(iso: string | Date): string {
  return `${thaiDateTime.format(typeof iso === "string" ? new Date(iso) : iso)} น.`;
}

/** Seconds -> "2:15:00" above an hour, "48:12" below. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
