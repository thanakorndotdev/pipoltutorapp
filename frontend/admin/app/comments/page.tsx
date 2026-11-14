"use client";
import { useEffect, useState } from "react";
import { Button, Card, Note, PageHeader, inputClass } from "@/components/ui";
import { useAdmin, errorMessage } from "@/lib/admin";
type Comment = {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  text: string;
  status: string;
  flags: string[];
  createdAt: string;
};
type Profile = {
  id: string;
  nickname: string | null;
  bio: string | null;
  photoUrl: string | null;
  updatedAt: string;
};
export default function Page() {
  const { api } = useAdmin();
  const [items, setItems] = useState<Comment[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [status, setStatus] = useState("flagged_pending"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status === "profiles") {
      api<{ profiles: Profile[] }>("/admin/comments/profiles")
        .then((r) => setProfiles(r.profiles))
        .catch((e) => setError(errorMessage(e)));
      return;
    }
    api<{ comments: Comment[] }>(
      `/admin/comments${status ? `?status=${status}` : ""}`,
    )
      .then((r) => setItems(r.comments))
      .catch((e) => setError(errorMessage(e)));
  }, [api, status]);
  async function change(id: string, action: string) {
    setBusy(true);
    try {
      await api(`/admin/comments/${id}`, {
        method: "PUT",
        json: { action, reason },
      });
      setItems(items.filter((c) => c.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function clearProfile(p: Profile, what: { photo: boolean; bio: boolean }) {
    setBusy(true);
    try {
      await api(`/admin/comments/profiles/${p.id}/clear`, {
        method: "POST",
        json: { ...what, reason },
      });
      setProfiles(
        profiles
          .map((x) =>
            x.id === p.id
              ? { ...x, photoUrl: what.photo ? null : x.photoUrl, bio: what.bio ? null : x.bio }
              : x,
          )
          .filter((x) => x.photoUrl || x.bio),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="ตรวจความคิดเห็น"
        sub="ข้อความที่ถูกแจ้งจะถูกซ่อนจนกว่าจะอนุมัติ การจัดการทุกครั้งบันทึกเหตุผลและผู้ดำเนินการ"
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <select
        aria-label="สถานะความคิดเห็น"
        className={inputClass}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        {[
          ["flagged_pending", "รอตรวจ"],
          ["published", "เผยแพร่"],
          ["rejected", "ปฏิเสธ"],
          ["hidden", "ซ่อน"],
          ["deleted", "ลบแล้ว"],
          ["", "ทั้งหมด"],
          ["profiles", "โปรไฟล์นักเรียน (รูปและแนะนำตัว)"],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input
        aria-label="เหตุผล"
        className={inputClass}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="เหตุผล (อย่างน้อย 3 ตัวอักษร)"
      />
      {status === "profiles"
        ? profiles.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-4">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded profile photo under review
                  <img src={p.photoUrl} alt="" className="size-20 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="font-medium">{p.nickname ?? "ไม่มีชื่อเล่น"} · ผู้ใช้ {p.id}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[16px]">{p.bio ?? "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button kind="danger" disabled={busy || !p.photoUrl || reason.trim().length < 3} onClick={() => void clearProfile(p, { photo: true, bio: false })}>
                  ล้างรูป
                </Button>
                <Button kind="danger" disabled={busy || !p.bio || reason.trim().length < 3} onClick={() => void clearProfile(p, { photo: false, bio: true })}>
                  ล้างแนะนำตัว
                </Button>
              </div>
            </Card>
          ))
        : null}
      {status !== "profiles" && items.map((c) => (
        <Card key={c.id} className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap text-[16px]">{c.text}</p>
          <p className="text-[14px] text-ink2">
            {c.status} · {c.flags.join(", ")} · ผู้ใช้ {c.userId}
          </p>
          {c.parentId ? (
            <div className="rounded-[12px] bg-page p-3">
              <p className="text-[14px]">ตอบความคิดเห็น {c.parentId}</p>
              <p>
                {items.find((p) => p.id === c.parentId)?.text ??
                  "ดูบริบทจากหน้าบทความ"}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              ["approve", "อนุมัติ"],
              ["reject", "ปฏิเสธ"],
              ["hide", "ซ่อน"],
              ["delete", "ลบ"],
            ].map(([action, label]) => (
              <Button
                key={action}
                kind={action === "delete" ? "danger" : "ghost"}
                disabled={busy || reason.trim().length < 3}
                onClick={() => void change(c.id, action!)}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      ))}
      {status === "profiles"
        ? !profiles.length ? <p>ยังไม่มีโปรไฟล์ที่มีรูปหรือแนะนำตัว</p> : null
        : !items.length ? <p>ไม่มีความคิดเห็นในสถานะนี้</p> : null}
    </>
  );
}
