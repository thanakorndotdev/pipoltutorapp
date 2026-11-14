import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { fail } from "./common";

export async function readSheet(
  file: File,
  allowedHeaders: string[],
): Promise<Record<string, string>[]> {
  if (file.size > 3 * 1024 * 1024) fail("ไฟล์ต้องไม่เกิน 3 MB");
  const workbook = new ExcelJS.Workbook();
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    if (file.name.toLowerCase().endsWith(".xlsx"))
      await workbook.xlsx.load(
        bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    else if (file.name.toLowerCase().endsWith(".csv"))
      await workbook.csv.read(
        Readable.from([bytes.toString("utf8").replace(/^\uFEFF/, "")]),
        { map: (value) => value },
      );
    else fail("รองรับ .xlsx และ .csv เท่านั้น");
  } catch {
    fail("อ่านไฟล์ไม่ได้ กรุณาใช้เทมเพลต XLSX/CSV ที่กำหนด");
  }
  const sheet = workbook.worksheets[0];
  if (
    !sheet ||
    sheet.rowCount < 2 ||
    sheet.rowCount > 5001 ||
    sheet.columnCount > 40
  )
    fail("ไฟล์ต้องมีข้อมูล 1–5,000 แถวและไม่เกิน 40 คอลัมน์");
  const header: string[] = [];
  for (let c = 1; c <= sheet!.columnCount; c++)
    header.push(sheet!.getRow(1).getCell(c).text.trim());
  if (
    new Set(header).size !== header.length ||
    header.some((h) => !allowedHeaders.includes(h))
  )
    fail("ชื่อคอลัมน์ซ้ำหรือไม่ตรงเทมเพลต");
  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet!.rowCount; r++) {
    const row: Record<string, string> = {};
    for (let c = 1; c <= header.length; c++) {
      const cell = sheet!.getRow(r).getCell(c);
      if (
        cell.type === ExcelJS.ValueType.Formula ||
        (typeof cell.value === "object" &&
          cell.value !== null &&
          "hyperlink" in cell.value)
      )
        fail(`แถว ${r}: ไม่รองรับสูตรหรือลิงก์ในเซลล์`);
      row[header[c - 1]!] = cell.text.trim();
    }
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return rows;
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((value) => {
            let s = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
