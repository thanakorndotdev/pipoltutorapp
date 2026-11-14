/** Native renderer smoke check, also runnable inside the Alpine backend image. No DB queries. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GlobalFonts, loadImage } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

import {
  DEFAULT_LAYOUT,
  SHEET,
  type CertData,
} from "../src/certificates/layout";
import { pngToPdf, renderPng } from "../src/certificates/render";

const output = process.argv[2] ?? join(tmpdir(), "pipol-certificate-render");
const data: CertData = {
  recipient_full_name: "ปัณณวิชญ์ เจริญเลิศกมลวัฒนพงศ์",
  grade: "ระดับชั้น ม.4",
  subject: "คณิตศาสตร์",
  exam_title: "ข้อสอบเสมือนจริง ชุดที่ 1",
  certificate_id: "PT-000123",
  issue_date: "13 พฤศจิกายน 2569",
  issuer_name: "พี่พิพล",
  score: "82.5",
  max_score: "100",
  percent: "83%",
  rank: "",
};
assert.ok(
  GlobalFonts.has("Mitr") && GlobalFonts.has("Anuphan"),
  "bundled Thai fonts must load",
);
await mkdir(output, { recursive: true });
for (const paper of ["a4-landscape", "a4-portrait"] as const) {
  for (const language of ["thai", "english"] as const) {
    const layout = { ...DEFAULT_LAYOUT, paper };
    const png = await renderPng({
      layout,
      data: {
        ...data,
        ...(language === "english"
          ? {
              recipient_full_name:
                "Alexandria Montgomery-Wellington Rattanakosin",
            }
          : {}),
      },
      verifyUrl: "https://pipoltutor.org/cert/preview-only",
    });
    const image = await loadImage(png);
    assert.equal(image.width, Math.round(SHEET[paper].w * 1.5));
    assert.equal(image.height, Math.round(SHEET[paper].h * 1.5));
    const bytes = await pngToPdf(png, paper, "ตัวอย่างเกียรติบัตร");
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(
      [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()],
      [...SHEET[paper].pdf],
    );
    const name = `${paper}-${language}`;
    await Bun.write(join(output, `${name}.png`), png);
    await Bun.write(join(output, `${name}.pdf`), bytes);
    console.log(
      `PASS ${name}: ${image.width}×${image.height} PNG, one A4 PDF page`,
    );
  }
}
console.log(`Renderer smoke passed; samples: ${output}`);
