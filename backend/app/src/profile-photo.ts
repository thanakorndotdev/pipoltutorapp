import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { PUBLIC_PREFIX, UPLOAD_DIR, randomName, sniffImage, uploadedFilePath } from "./routes/uploads";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Output edge in pixels; profile photos are always square. */
const PHOTO_EDGE = 512;
/** Refuse to decode anything larger, so a small compressed file cannot expand into gigabytes. */
const MAX_PIXELS = 40_000_000;

const ACCEPTED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export class PhotoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Width and height from the file header, without decoding pixels. */
function dimensions(bytes: Uint8Array, kind: string): { w: number; h: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === "png" && bytes.length >= 24) return { w: view.getUint32(16), h: view.getUint32(20) };
  if (kind === "webp" && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8X") return { w: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), h: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
    if (chunk === "VP8 ") return { w: view.getUint16(26, true) & 0x3fff, h: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const b = view.getUint32(21, true);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (kind === "jpg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      const len = view.getUint16(i + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { h: view.getUint16(i + 5), w: view.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Validate an uploaded photo, centre-crop it to a square and re-encode it as
 * WebP. Re-encoding drops EXIF (including phone GPS) and anything appended
 * to the image. Returns the public /api/uploads/... URL.
 */
export async function storeProfilePhoto(file: File): Promise<string> {
  const ext = ACCEPTED[file.type];
  if (!ext) throw new PhotoError("รองรับเฉพาะรูป PNG, JPEG หรือ WebP", 415);
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError("ไฟล์ใหญ่เกิน 5 MB", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffImage(bytes.subarray(0, 16)) !== ext) throw new PhotoError("ไฟล์ไม่ใช่รูปภาพตามนามสกุลที่ระบุ", 415);
  const size = dimensions(bytes, ext);
  if (!size || size.w < 1 || size.h < 1) throw new PhotoError("อ่านขนาดรูปไม่ได้ ลองบันทึกรูปใหม่แล้วอัปโหลดอีกครั้ง", 422);
  if (size.w * size.h > MAX_PIXELS) throw new PhotoError("รูปมีความละเอียดสูงเกินไป", 413);

  let image;
  try {
    image = await loadImage(Buffer.from(bytes));
  } catch {
    throw new PhotoError("เปิดไฟล์รูปไม่ได้", 422);
  }
  const side = Math.min(image.width, image.height);
  const canvas = createCanvas(PHOTO_EDGE, PHOTO_EDGE);
  canvas.getContext("2d").drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, PHOTO_EDGE, PHOTO_EDGE);
  const out = await canvas.encode("webp", 85);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = randomName("webp");
  await Bun.write(join(UPLOAD_DIR, name), out);
  return `${PUBLIC_PREFIX}/${name}`;
}

/** Remove a photo this module stored; anything that is not one of our upload files is left alone. */
export async function removeProfilePhoto(url: string | null | undefined): Promise<void> {
  const path = uploadedFilePath(url);
  if (path) await unlink(path).catch(() => {});
}
