import { join } from "node:path";

import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";

import type { CertElement, CertLayout } from "../db/schema";
import { uploadedFilePath } from "../routes/uploads";
import { fillFields, SHEET, type CertData } from "./layout";

/**
 * Server-side certificate renderer (CERT-06). The sheet is drawn from a
 * layout plus trusted data only — nothing a browser sends is ever printed.
 * Fonts are bundled so the output is the same on every host.
 */
const FONT_DIR = join(import.meta.dir, "../../assets/fonts");
for (const file of ["Mitr-Regular.ttf", "Mitr-Medium.ttf", "Mitr-SemiBold.ttf"]) GlobalFonts.registerFromPath(join(FONT_DIR, file), "Mitr");
GlobalFonts.registerFromPath(join(FONT_DIR, "Anuphan-wght.ttf"), "Anuphan");

const FAMILY = { display: "Mitr", body: "Anuphan" } as const;
/** Output pixels per sheet unit: 3000 px across A4 landscape, about 257 dpi. */
const SCALE = 1.5;

const C = { brand: "#3a5bd9", brandDark: "#1e2f86", brandDeep: "#121d52", tint: "#eef2ff", amber: "#f59e0b", ink: "#111c3e", rule: "#8493b4" };

type Ctx = SKRSContext2D;

/** Only files uploaded through /admin/uploads are ever read: no network fetch, so a template cannot make the server call out. */
async function loadUpload(url: string | null | undefined): Promise<Image | null> {
  const path = uploadedFilePath(url);
  if (!path || !(await Bun.file(path).exists())) return null;
  try {
    return await loadImage(path);
  } catch {
    return null;
  }
}

/** Thai has no spaces between words; break lines on word boundaries. */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const seg = new Intl.Segmenter("th", { granularity: "word" });
  for (const para of text.split("\n")) {
    let line = "";
    for (const { segment } of seg.segment(para)) {
      if (line.trim() && ctx.measureText(line + segment).width > maxWidth) {
        lines.push(line.trim());
        line = segment.trimStart();
      } else line += segment;
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawContained(ctx: Ctx, img: Image, cx: number, cy: number, maxW: number, maxH: number) {
  const k = Math.min(maxW / img.width, maxH / img.height);
  ctx.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
}

/** Built-in sheet: tinted corners, double frame, brand row, rosette, signature rule. */
function drawStandardDecor(ctx: Ctx, W: number, H: number, logo: Image | null) {
  ctx.save();
  roundRect(ctx, 44, 44, W - 88, H - 88, 40);
  ctx.clip();
  ctx.fillStyle = C.tint;
  for (const [x, y, r] of [
    [W - 30, 30, 400],
    [30, H - 30, 360],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 12;
  ctx.strokeStyle = C.brandDark;
  roundRect(ctx, 44, 44, W - 88, H - 88, 40);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.amber;
  roundRect(ctx, 72, 72, W - 144, H - 144, 26);
  ctx.stroke();

  const mark = 84;
  ctx.font = `500 46px ${FAMILY.display}`;
  ctx.textBaseline = "middle";
  const groupW = mark + 22 + ctx.measureText("pipoltutor").width;
  const x = W / 2 - groupW / 2;
  const y = 150;
  if (logo) drawContained(ctx, logo, x + mark / 2, y + mark / 2, mark, mark);
  else {
    const grad = ctx.createLinearGradient(x, y, x + mark, y + mark);
    grad.addColorStop(0, C.brandDeep);
    grad.addColorStop(1, C.brand);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, mark, mark, 26);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 34px ${FAMILY.display}`;
    ctx.textAlign = "center";
    ctx.fillText("จภ", x + mark / 2, y + mark / 2 + 2);
  }
  ctx.fillStyle = C.ink;
  ctx.font = `500 46px ${FAMILY.display}`;
  ctx.textAlign = "left";
  ctx.fillText("pipoltutor", x + mark + 22, y + mark / 2 + 2);

  // Rosette, bottom left.
  const cx = 330;
  const cy = H - 318;
  ctx.fillStyle = C.brandDark;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + d * 14, cy + 40);
    ctx.lineTo(cx + d * 88, cy + 196);
    ctx.lineTo(cx + d * 44, cy + 176);
    ctx.lineTo(cx + d * 20, cy + 214);
    ctx.lineTo(cx - d * 30, cy + 60);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = C.amber;
  ctx.beginPath();
  for (let i = 0; i < 56; i++) {
    const r = i % 2 === 0 ? 104 : 93;
    const a = (i / 56) * Math.PI * 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 76, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 19;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // Rule the issuer signs above.
  ctx.fillStyle = C.rule;
  ctx.fillRect(W / 2 - 230, H * 0.846, 460, 2);
}

function drawText(ctx: Ctx, el: Extract<CertElement, { type: "text" }>, data: CertData, W: number, H: number) {
  // A line whose placeholders all came out empty ("{grade} {subject}" on a pack with neither) is dropped.
  const value = fillFields(el.text, data)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (!value) return;
  const maxW = el.w * W;
  let size = el.size;
  const font = () => `${el.weight} ${size}px ${FAMILY[el.font]}`;
  ctx.font = font();
  let lines: string[];
  if (el.fit) {
    lines = [value.replace(/\n/g, " ")];
    while (size > el.size * 0.5 && ctx.measureText(lines[0]!).width > maxW) {
      size -= 2;
      ctx.font = font();
    }
  } else lines = wrap(ctx, value, maxW);
  ctx.fillStyle = el.color;
  ctx.textAlign = el.align;
  ctx.textBaseline = "middle";
  const leading = size * (el.lineHeight ?? 1.6);
  lines.forEach((line, i) => ctx.fillText(line, el.x * W, el.y * H + i * leading, maxW));
}

function drawQr(ctx: Ctx, el: Extract<CertElement, { type: "qr" }>, url: string, W: number, H: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const box = el.size * W;
  const quiet = 4;
  const cell = box / (n + quiet * 2);
  const x0 = el.x * W - box / 2;
  const y0 = el.y * H - box / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, box, box);
  ctx.fillStyle = "#000000";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(x, y)) ctx.fillRect(x0 + (x + quiet) * cell, y0 + (y + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
}

export type RenderInput = { layout: CertLayout; data: CertData; verifyUrl: string; logoUrl?: string | null };

/** PNG of the sheet. `scale` below 1 gives a light preview. */
export async function renderPng({ layout, data, verifyUrl, logoUrl }: RenderInput, scale = SCALE): Promise<Buffer> {
  const sheet = SHEET[layout.paper];
  const { w: W, h: H } = sheet;
  const canvas = createCanvas(Math.round(W * scale), Math.round(H * scale));
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const background = await loadUpload(layout.background);
  if (background) {
    const fit = layout.backgroundFit ?? { zoom: 1, offsetX: 0, offsetY: 0 };
    const k = Math.max(W / background.width, H / background.height) * Math.max(1, fit.zoom);
    const bw = background.width * k;
    const bh = background.height * k;
    ctx.drawImage(background, (W - bw) / 2 + (fit.offsetX * (bw - W)) / 2, (H - bh) / 2 + (fit.offsetY * (bh - H)) / 2, bw, bh);
  }
  if (layout.decor === "standard") drawStandardDecor(ctx, W, H, await loadUpload(logoUrl));

  for (const el of layout.elements) {
    if (el.type === "text") drawText(ctx, el, data, W, H);
    else if (el.type === "qr") drawQr(ctx, el, verifyUrl, W, H);
    else {
      const img = await loadUpload(el.url);
      if (img) {
        if(el.crop){const w=el.w*W,h=el.h*H,k=Math.max(w/img.width,h/img.height)*el.crop.zoom,bw=img.width*k,bh=img.height*k;ctx.save();ctx.beginPath();ctx.rect(el.x*W-w/2,el.y*H-h/2,w,h);ctx.clip();ctx.drawImage(img,el.x*W-bw/2+el.crop.offsetX*(bw-w)/2,el.y*H-bh/2+el.crop.offsetY*(bh-h)/2,bw,bh);ctx.restore();}
        else drawContained(ctx, img, el.x * W, el.y * H, el.w * W, el.h * H);
      }
    }
  }
  return canvas.toBuffer("image/png");
}

/** The same PNG on one A4 page. */
export async function pngToPdf(png: Buffer, paper: CertLayout["paper"], title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setProducer("pipoltutor");
  const [pw, ph] = SHEET[paper].pdf;
  const page = pdf.addPage([pw, ph]);
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: pw, height: ph });
  return pdf.save();
}
