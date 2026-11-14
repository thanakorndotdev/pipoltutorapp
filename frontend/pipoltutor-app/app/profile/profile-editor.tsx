"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ProfilePhoto } from "@/components/profile-card";
import { Button, Icon } from "@/components/ui";
import { BIO_MAX } from "@/lib/profile-limits";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `${fallback} (${res.status})`;
}

/** Change photo and write a short bio. Saves straight to /api/profile/*. */
export function ProfileEditor({
  photo,
  hasUploadedPhoto,
  bio: initialBio,
}: {
  photo: string | null;
  hasUploadedPhoto: boolean;
  bio: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(initialBio ?? "");
  const [saved, setSaved] = useState(initialBio ?? "");
  const [busy, setBusy] = useState<"photo" | "bio" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) return setMessage({ tone: "error", text: "รองรับเฉพาะรูป PNG, JPEG หรือ WebP" });
    if (file.size > MAX_BYTES) return setMessage({ tone: "error", text: "ไฟล์ใหญ่เกิน 5 MB" });
    setBusy("photo");
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res, "อัปโหลดรูปไม่สำเร็จ"));
      setMessage({ tone: "ok", text: "เปลี่ยนรูปโปรไฟล์แล้ว" });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ" });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setBusy("photo");
    setMessage(null);
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "ลบรูปไม่สำเร็จ"));
      setMessage({ tone: "ok", text: "กลับไปใช้รูปจากบัญชี Google แล้ว" });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "ลบรูปไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  async function saveBio() {
    setBusy("bio");
    setMessage(null);
    try {
      const res = await fetch("/api/profile/about", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      if (!res.ok) throw new Error(await readError(res, "บันทึกไม่สำเร็จ"));
      const data = (await res.json()) as { bio: string | null };
      setBio(data.bio ?? "");
      setSaved(data.bio ?? "");
      setMessage({ tone: "ok", text: "บันทึกแนะนำตัวแล้ว" });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  const left = BIO_MAX - [...bio].length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProfilePhoto src={photo} size={88} />
        <div className="flex flex-col gap-2">
          <p className="font-display text-[17px] font-medium">รูปโปรไฟล์</p>
          <p className="text-[14px] leading-[1.7] text-ink3">PNG, JPEG หรือ WebP ไม่เกิน 5 MB ระบบตัดเป็นสี่เหลี่ยมจัตุรัสและลบข้อมูลตำแหน่งในรูปให้อัตโนมัติ</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              id="profile-photo-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <Button kind="brand" icon="photo_camera" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === "photo" ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}
            </Button>
            {hasUploadedPhoto ? (
              <Button kind="ghost" icon="delete" disabled={busy !== null} onClick={() => void removePhoto()}>
                ใช้รูปจาก Google
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="profile-bio" className="font-display text-[17px] font-medium">
          แนะนำตัว
        </label>
        <textarea
          id="profile-bio"
          rows={4}
          value={bio}
          maxLength={BIO_MAX}
          onChange={(e) => setBio(e.target.value)}
          placeholder="เช่น อยากเข้า จภ. เชียงราย ชอบเรขาคณิต กำลังฝึกโจทย์ทุกวัน"
          className="w-full rounded-[14px] border-[1.5px] border-border bg-page px-4 py-3 text-[16px] leading-[1.8] text-ink placeholder:text-ink3"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-[13.5px] ${left < 20 ? "text-red" : "text-ink3"}`}>เหลือ {left} ตัวอักษร · เพื่อนที่เข้าสู่ระบบจะเห็นข้อความนี้</p>
          <Button kind="brand" icon="save" disabled={busy !== null || bio === saved} onClick={() => void saveBio()}>
            {busy === "bio" ? "กำลังบันทึก…" : "บันทึกแนะนำตัว"}
          </Button>
        </div>
      </div>

      {message ? (
        <p role="status" className={`flex items-center gap-2 text-[14.5px] ${message.tone === "ok" ? "text-green" : "text-red"}`}>
          <Icon name={message.tone === "ok" ? "check_circle" : "error"} size={18} fill />
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
