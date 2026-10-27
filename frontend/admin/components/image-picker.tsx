"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Button, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * URL field + "อัปโหลดรูป" button + preview. Uploads go to POST /admin/uploads
 * and the returned /api/uploads/<name> path becomes the value (the URL field is
 * then hidden); pasting an external https link works too. Controlled: the parent owns `value`.
 */
export function ImagePicker({
  id,
  value,
  onChange,
  onError,
  ratio,
  previewClass = "max-h-40",
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  onError: (message: string | null) => void;
  /** CSS aspect-ratio for the preview box, e.g. "16 / 9". */
  ratio?: string;
  previewClass?: string;
}) {
  const { api } = useAdmin();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = value.trim();
  // Uploaded files are referenced by path; the admin never needs to see or edit it.
  const uploaded = url.startsWith("/api/uploads/");

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setUploading(true);
    onError(null);
    try {
      const res = await api<{ url: string }>("/admin/uploads", { method: "POST", body });
      onChange(res.url);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {uploaded ? (
          <p id={id} className="flex min-h-[44px] min-w-0 flex-1 items-center text-[14px] text-ink2">
            อัปโหลดรูปจากเครื่องแล้ว
          </p>
        ) : (
          <input
            id={id}
            className={`${inputClass} min-w-0 flex-1`}
            type="url"
            inputMode="url"
            placeholder="อัปโหลดจากเครื่อง หรือวางลิงก์รูป https://…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={upload} />
        <Button kind="ghost" icon={uploading ? "hourglass_top" : "upload"} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "กำลังอัปโหลด…" : uploaded ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        </Button>
      </div>
      {url ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-page p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary hosts */}
          <img src={url} alt="" className={`${previewClass} max-w-full rounded-[8px] object-contain`} style={ratio ? { aspectRatio: ratio } : undefined} />
          <Button kind="subtle" size="sm" icon="close" className="ml-auto" onClick={() => onChange("")}>
            เอาออก
          </Button>
        </div>
      ) : null}
    </div>
  );
}
