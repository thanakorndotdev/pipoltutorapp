"use client";
import { useState } from "react";
import { ImagePicker } from "./image-picker";
import { Button, inputClass } from "./ui";
import { useAdmin, errorMessage } from "@/lib/admin";
import type { ArticleBlock } from "@/lib/types";
export const blockLabels: Record<ArticleBlock["type"], string> = {
  heading: "หัวข้อ",
  text: "ข้อความ",
  rich: "ข้อความจัดรูปแบบ",
  image: "รูปภาพ",
  list: "รายการ",
  quote: "ข้อความอ้างอิง",
  code: "โค้ด",
  callout: "ข้อความเน้น",
  math: "สมการ LaTeX",
  separator: "เส้นแบ่ง",
  button: "ปุ่มลิงก์",
  attachment: "เอกสารแนบ",
  video: "YouTube / TikTok",
  columns: "คอลัมน์",
  table: "ตาราง",
};
function blank(type: ArticleBlock["type"]): ArticleBlock {
  if (type === "image") return { type, url: "", alt: "", caption: "" };
  if (type === "separator") return { type };
  if (type === "list") return { type, items: [""], ordered: false };
  if (type === "button" || type === "attachment")
    return { type, url: "", text: "" };
  if (type === "video") return { type, url: "", title: "" };
  if (type === "columns") return { type, columns: [[], []] };
  if (type === "table")
    return {
      type,
      rows: [
        [{ text: "" }, { text: "" }],
        [{ text: "" }, { text: "" }],
      ],
    };
  return { type, text: "" };
}
export function BlockEditor({
  blocks,
  onChange,
  onError,
  depth = 0,
}: {
  blocks: ArticleBlock[];
  onChange: (b: ArticleBlock[]) => void;
  onError: (s: string) => void;
  depth?: number;
}) {
  const { api } = useAdmin();
  const [kind, setKind] = useState<ArticleBlock["type"]>("text"),
    [media, setMedia] = useState<
      {
        name: string;
        url: string;
        metadata?: { alt?: string; caption?: string };
      }[]
    >([]),
    [target, setTarget] = useState<number | null>(null);
  const patch = (i: number, p: Partial<ArticleBlock>) =>
    onChange(
      blocks.map((b, j) => (i === j ? ({ ...b, ...p } as ArticleBlock) : b)),
    );
  const move = (i: number, n: number) => {
    const copy = [...blocks];
    const [x] = copy.splice(i, 1);
    copy.splice(i + n, 0, x!);
    onChange(copy);
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {blocks.map((b, i) => (
        <fieldset
          key={i}
          className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border p-4"
        >
          <legend className="px-2 text-[15px] font-medium">
            {i + 1}. {blockLabels[b.type]}
          </legend>
          <div className="flex flex-wrap justify-end gap-2">
            <Button kind="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
              ขึ้น
            </Button>
            <Button
              kind="ghost"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, 1)}
            >
              ลง
            </Button>
            <Button
              kind="danger"
              onClick={() => onChange(blocks.filter((_, j) => j !== i))}
            >
              ลบ
            </Button>
          </div>
          {"text" in b ? (
            <textarea
              aria-label={`เนื้อหาบล็อก ${i + 1}`}
              rows={b.type === "heading" ? 2 : 5}
              className={inputClass}
              value={b.text}
              onChange={(e) => patch(i, { text: e.target.value })}
            />
          ) : null}
          {b.type === "text" || b.type === "rich" ? (
            <p className="text-[14px] text-ink2">
              **ตัวหนา** · *ตัวเอียง* · __ขีดเส้นใต้__ · $สมการ$ · [ข้อความ](https://…)
            </p>
          ) : null}
          {b.type === "rich" ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <label>
                ขนาด
                <input
                  aria-label="ขนาดตัวอักษร"
                  className={inputClass}
                  type="number"
                  min={16}
                  max={72}
                  value={b.fontSize ?? 17}
                  onChange={(e) =>
                    patch(i, { fontSize: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                สีข้อความ
                <input
                  aria-label="สีข้อความ"
                  type="color"
                  className="min-h-[44px] w-full"
                  value={b.color ?? "#46557a"}
                  onChange={(e) => patch(i, { color: e.target.value })}
                />
              </label>
              <label>
                พื้นหลัง
                <input
                  aria-label="สีพื้นหลัง"
                  type="color"
                  className="min-h-[44px] w-full"
                  value={b.background ?? "#ffffff"}
                  onChange={(e) => patch(i, { background: e.target.value })}
                />
              </label>
              <select
                aria-label="จัดแนว"
                className={inputClass}
                value={b.align ?? "left"}
                onChange={(e) =>
                  patch(i, {
                    align: e.target.value as "left" | "center" | "right",
                  })
                }
              >
                <option value="left">ชิดซ้าย</option>
                <option value="center">กึ่งกลาง</option>
                <option value="right">ชิดขวา</option>
              </select>
            </div>
          ) : null}
          {b.type === "image" ? (
            <>
              <ImagePicker
                id={`image-${depth}-${i}`}
                value={b.url}
                onChange={(url) => patch(i, { url })}
                onError={(message) => onError(message ?? "")}
              />
              <input
                aria-label="คำอธิบายภาพ"
                className={inputClass}
                value={b.alt}
                onChange={(e) => patch(i, { alt: e.target.value })}
                placeholder="คำอธิบายภาพ (จำเป็น)"
              />
              <input
                aria-label="คำบรรยายภาพ"
                className={inputClass}
                value={b.caption}
                onChange={(e) => patch(i, { caption: e.target.value })}
                placeholder="คำบรรยายใต้ภาพ"
              />
              <label className="text-[14px]">
                ความกว้าง (%)
                <input
                  aria-label="ความกว้างภาพ"
                  type="number"
                  min={10}
                  max={100}
                  className={inputClass}
                  value={b.width ?? 100}
                  onChange={(e) => patch(i, { width: Number(e.target.value) })}
                />
              </label>
              <select
                aria-label="จัดตำแหน่งรูป"
                className={inputClass}
                value={b.align ?? "center"}
                onChange={(e) =>
                  patch(i, {
                    align: e.target.value as "left" | "center" | "right",
                  })
                }
              >
                <option value="left">ซ้าย</option>
                <option value="center">กลาง</option>
                <option value="right">ขวา</option>
              </select>
            </>
          ) : null}
          {b.type === "image" || b.type === "attachment" ? (
            <Button
              kind="ghost"
              onClick={() => {
                setTarget(i);
                api<{ media: typeof media }>("/admin/media")
                  .then((r) => setMedia(r.media))
                  .catch((e) => onError(errorMessage(e)));
              }}
            >
              เลือกจากคลังสื่อ
            </Button>
          ) : null}
          {b.type === "video" ? (
            <>
              <input
                aria-label="ลิงก์วิดีโอ"
                className={inputClass}
                value={b.url}
                onChange={(e) => patch(i, { url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              <input
                aria-label="ชื่อวิดีโอ"
                className={inputClass}
                value={b.title}
                onChange={(e) => patch(i, { title: e.target.value })}
                placeholder="ชื่อวิดีโอ"
              />
            </>
          ) : null}
          {b.type === "button" || b.type === "attachment" ? (
            <input
              aria-label="ลิงก์ปลายทาง"
              className={inputClass}
              value={b.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              placeholder="https://… หรือ /api/attachments/…"
            />
          ) : null}
          {b.type === "attachment" ? (
            <input
              aria-label="อัปโหลดเอกสาร"
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const form = new FormData();
                  form.set("file", f);
                  const r = await api<{ url: string }>(
                    "/admin/media/attachments",
                    { method: "POST", body: form },
                  );
                  patch(i, { url: r.url, text: b.text || f.name });
                } catch (err) {
                  onError(errorMessage(err));
                }
              }}
            />
          ) : null}
          {b.type === "list" ? (
            <>
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={b.ordered}
                  onChange={(e) => patch(i, { ordered: e.target.checked })}
                />
                แสดงเลขลำดับ
              </label>
              <textarea
                aria-label="รายการหนึ่งบรรทัดต่อรายการ"
                className={inputClass}
                rows={4}
                value={b.items.join("\n")}
                onChange={(e) =>
                  patch(i, { items: e.target.value.split("\n") })
                }
              />
            </>
          ) : null}
          {b.type === "columns" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {b.columns.map((c, j) => (
                  <BlockEditor
                    key={j}
                    blocks={c}
                    onChange={(next) =>
                      patch(i, {
                        columns: b.columns.map((old, k) =>
                          j === k ? next : old,
                        ),
                      })
                    }
                    onError={onError}
                    depth={depth + 1}
                  />
                ))}
              </div>
              {b.columns.length === 2 ? (
                <Button
                  kind="ghost"
                  onClick={() => patch(i, { columns: [...b.columns, []] })}
                >
                  เพิ่มคอลัมน์ที่ 3
                </Button>
              ) : (
                <Button
                  kind="ghost"
                  onClick={() => patch(i, { columns: b.columns.slice(0, 2) })}
                >
                  ลบคอลัมน์สุดท้าย
                </Button>
              )}
            </>
          ) : null}
          {b.type === "table" ? (
            <>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td
                            key={k}
                            className="min-w-[160px] border border-border p-2"
                          >
                            <textarea
                              aria-label={`เซลล์แถว ${j + 1} คอลัมน์ ${k + 1}`}
                              className={inputClass}
                              value={c.text}
                              onChange={(e) =>
                                patch(i, {
                                  rows: b.rows.map((row, x) =>
                                    x === j
                                      ? row.map((cell, y) =>
                                          y === k
                                            ? { ...cell, text: e.target.value }
                                            : cell,
                                        )
                                      : row,
                                  ),
                                })
                              }
                            />
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label className="text-[14px]">
                                รวมแนวนอน
                                <input
                                  aria-label="จำนวนคอลัมน์ที่รวม"
                                  type="number"
                                  min={1}
                                  max={20}
                                  className={inputClass}
                                  value={c.colSpan ?? 1}
                                  onChange={(e) =>
                                    patch(i, {
                                      rows: b.rows.map((row, x) =>
                                        x === j
                                          ? row.map((cell, y) =>
                                              y === k
                                                ? {
                                                    ...cell,
                                                    colSpan: Number(
                                                      e.target.value,
                                                    ),
                                                  }
                                                : cell,
                                            )
                                          : row,
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label className="text-[14px]">
                                รวมแนวตั้ง
                                <input
                                  aria-label="จำนวนแถวที่รวม"
                                  type="number"
                                  min={1}
                                  max={100}
                                  className={inputClass}
                                  value={c.rowSpan ?? 1}
                                  onChange={(e) =>
                                    patch(i, {
                                      rows: b.rows.map((row, x) =>
                                        x === j
                                          ? row.map((cell, y) =>
                                              y === k
                                                ? {
                                                    ...cell,
                                                    rowSpan: Number(
                                                      e.target.value,
                                                    ),
                                                  }
                                                : cell,
                                            )
                                          : row,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <input
                              aria-label="พื้นหลังเซลล์"
                              type="color"
                              className="min-h-[44px] w-full"
                              value={c.background ?? "#ffffff"}
                              onChange={(e) =>
                                patch(i, {
                                  rows: b.rows.map((row, x) =>
                                    x === j
                                      ? row.map((cell, y) =>
                                          y === k
                                            ? {
                                                ...cell,
                                                background: e.target.value,
                                              }
                                            : cell,
                                        )
                                      : row,
                                  ),
                                })
                              }
                            />
                            <Button
                              kind="ghost"
                              onClick={() =>
                                patch(i, {
                                  rows: b.rows.map((row, x) =>
                                    x === j
                                      ? row.filter((_, y) => y !== k)
                                      : row,
                                  ),
                                })
                              }
                            >
                              ลบเซลล์นี้
                            </Button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  kind="ghost"
                  onClick={() =>
                    patch(i, {
                      rows: [
                        ...b.rows,
                        Array.from({ length: b.rows[0]?.length ?? 2 }, () => ({
                          text: "",
                        })),
                      ],
                    })
                  }
                >
                  เพิ่มแถว
                </Button>
                <Button
                  kind="ghost"
                  onClick={() =>
                    patch(i, { rows: b.rows.map((r) => [...r, { text: "" }]) })
                  }
                >
                  เพิ่มคอลัมน์
                </Button>
                <Button
                  kind="ghost"
                  disabled={b.rows.length < 2}
                  onClick={() => patch(i, { rows: b.rows.slice(0, -1) })}
                >
                  ลบแถวท้าย
                </Button>
                <Button
                  kind="ghost"
                  onClick={() =>
                    patch(i, { rows: b.rows.map((r) => r.slice(0, -1)) })
                  }
                >
                  ลบคอลัมน์ท้าย
                </Button>
              </div>
              <p className="text-[14px] text-ink2">
                รวมเซลล์ด้วยจำนวนแนวนอน/แนวตั้ง แล้วลบเซลล์ที่ถูกครอบออก
                ตัวอย่างแสดงผลอยู่ในหน้า Preview
              </p>
            </>
          ) : null}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="ชนิดบล็อกใหม่"
          className={`${inputClass} flex-1`}
          value={kind}
          onChange={(e) => setKind(e.target.value as ArticleBlock["type"])}
        >
          {(Object.keys(blockLabels) as ArticleBlock["type"][])
            .filter((t) => depth < 2 || t !== "columns")
            .map((t) => (
              <option key={t} value={t}>
                {blockLabels[t]}
              </option>
            ))}
        </select>
        <Button kind="ghost" onClick={() => onChange([...blocks, blank(kind)])}>
          เพิ่มบล็อก
        </Button>
      </div>
      {target !== null ? (
        <div className="rounded-[12px] border border-border p-3">
          <h3 className="font-semibold">คลังสื่อ</h3>
          {media.map((m) => (
            <button
              key={m.name}
              type="button"
              className="block min-h-[44px] max-w-full break-all text-left text-brand underline"
              onClick={() => {
                patch(target, {
                  url: m.url,
                  ...(blocks[target]?.type === "image"
                    ? {
                        alt: m.metadata?.alt ?? "",
                        caption: m.metadata?.caption ?? "",
                      }
                    : {}),
                });
                setTarget(null);
              }}
            >
              {m.name}
            </button>
          ))}
          <Button kind="ghost" onClick={() => setTarget(null)}>
            ปิดคลังสื่อ
          </Button>
        </div>
      ) : null}
    </div>
  );
}
