"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Card, Empty, Icon, Note, PageHeader, Spinner, Tag, inputClass } from "@/components/ui";
import { errorMessage, useAdmin } from "@/lib/admin";
import { formatThaiDateTime } from "@/lib/format";
import { ROLES, roleMeta, type AdminUser, type UserRole, type UsersResponse } from "@/lib/types";

export function UsersTable() {
  const { api, auth } = useAdmin();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const load = useCallback(() => {
    const qs = submitted ? `?q=${encodeURIComponent(submitted)}` : "";
    api<UsersResponse>(`/admin/users${qs}`)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [api, submitted]);
  useEffect(load, [load]);

  const replace = (u: AdminUser) =>
    setData((prev) => {
      if (!prev) return prev;
      const before = prev.users.find((x) => x.id === u.id);
      const counts = { ...prev.counts };
      if (before && before.role !== u.role) {
        counts[before.role] = Math.max(0, (counts[before.role] ?? 1) - 1);
        counts[u.role] = (counts[u.role] ?? 0) + 1;
      }
      return { ...prev, counts, users: prev.users.map((x) => (x.id === u.id ? u : x)) };
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ผู้ใช้และสิทธิ์"
        sub="ทุกคนที่เข้าสู่ระบบด้วย Google จะเป็นนักเรียนก่อน เปลี่ยนสิทธิ์ได้ที่นี่"
        actions={
          <Button kind="ghost" icon="refresh" onClick={load}>
            รีเฟรช
          </Button>
        }
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-[14px] text-ink2" title={r.desc}>
              <Tag tone={r.tone}>{r.label}</Tag>
              {data?.counts[r.id] ?? 0}
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
        >
          <input className={inputClass} placeholder="ค้นหาอีเมลหรือชื่อ" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" kind="ghost" icon="search">
            ค้นหา
          </Button>
        </form>
      </Card>
      {!data ? (
        <Spinner />
      ) : data.users.length === 0 ? (
        <Empty icon="group">ยังไม่มีผู้ใช้{submitted ? "ที่ตรงกับคำค้น" : " — จะปรากฏหลังมีคนเข้าสู่ระบบด้วย Google"}</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {data.users.map((u) => (
            <UserRow key={u.id} user={u} self={auth?.via === "session" && auth.user.id === u.id} onSaved={replace} />
          ))}
          {data.users.length >= 50 ? <p className="text-center text-[13.5px] text-ink3">แสดง 50 รายการแรก — ใช้ช่องค้นหาเพื่อหาคนที่เหลือ</p> : null}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, self, onSaved }: { user: AdminUser; self: boolean; onSaved: (u: AdminUser) => void }) {
  const { api } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = roleMeta(user.role);

  async function change(role: UserRole) {
    if (role === user.role) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: AdminUser }>(`/admin/users/${user.id}`, { method: "PATCH", json: { role } });
      onSaved(r.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar
          <img src={user.avatarUrl} alt="" className="size-10 shrink-0 rounded-full" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
            <Icon name="person" size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15.5px] font-medium">
            {user.displayName ?? user.email}
            {self ? <span className="ml-2 text-[12.5px] text-ink3">(คุณ)</span> : null}
          </p>
          <p className="truncate text-[13.5px] text-ink3">
            {user.email}
            {user.createdAt ? ` · สมัคร ${formatThaiDateTime(user.createdAt)}` : ""}
          </p>
        </div>
        <Tag tone={meta.tone}>{meta.label}</Tag>
        <label className="flex items-center gap-2 text-[14px] text-ink2">
          <span className="sr-only">สิทธิ์ของ {user.email}</span>
          <select
            className={`${inputClass} w-auto min-w-[150px]`}
            value={user.role}
            disabled={busy}
            onChange={(e) => void change(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} ({r.id})
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <Note tone="error">{error}</Note> : null}
    </Card>
  );
}
