"use client";
import { useState } from "react";
import { Button, inputClass } from "./ui";
import { useAdmin, errorMessage } from "@/lib/admin";
import type { AdminUser } from "@/lib/types";
const modules: Record<string, string> = {
  exam: "ข้อสอบ",
  certificate: "เกียรติบัตร",
  ranking: "อันดับ",
  article: "บทความ",
  comment: "ความคิดเห็น",
  daily: "โจทย์ประจำวัน",
  audit: "ประวัติ",
  site: "เว็บไซต์",
};
const actions: Record<string, string> = {
  read: "ดู",
  write: "แก้ไข",
  publish: "เผยแพร่",
  export: "ส่งออก",
};
export function PermissionEditor({ user }: { user: AdminUser }) {
  const { api } = useAdmin();
  const [open, setOpen] = useState(false),
    [role, setRole] = useState(user.staffRole ?? "none"),
    [grants, setGrants] = useState<Record<string, string[]>>(
      user.modulePermissions ?? {},
    ),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="border-t border-border pt-3">
      <Button kind="ghost" onClick={() => setOpen(!open)}>
        สิทธิ์โมดูล: {user.staffRole ?? "ตามบทบาทเดิม"}
      </Button>
      {open ? (
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            แม่แบบบทบาท
            <select
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {[
                ["owner", "Owner"],
                ["admin", "Admin"],
                ["author", "Author"],
                ["moderator", "Moderator"],
                ["results_viewer", "Results Viewer"],
                ["none", "ไม่มีสิทธิ์ทีมงาน"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[14px] text-ink2">
            สิทธิ์กำหนดเองแทนที่แม่แบบเฉพาะโมดูลที่เปิดกำหนด Owner
            เท่านั้นเปลี่ยนสิทธิ์และจัดการกุญแจลงนามได้
          </p>
          {Object.entries(modules).map(([m, label]) => (
            <fieldset key={m} className="flex flex-wrap gap-3">
              <legend className="font-medium">{label}</legend>
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={grants[m] !== undefined}
                  onChange={(e) => {
                    const next = { ...grants };
                    if (e.target.checked) next[m] = [];
                    else delete next[m];
                    setGrants(next);
                  }}
                />
                กำหนดเอง
              </label>
              {Object.entries(actions).map(([a, l]) => (
                <label key={a} className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={grants[m] === undefined}
                    checked={grants[m]?.includes(a) ?? false}
                    onChange={(e) =>
                      setGrants({
                        ...grants,
                        [m]: e.target.checked
                          ? [...(grants[m] ?? []), a]
                          : (grants[m] ?? []).filter((x) => x !== a),
                      })
                    }
                  />
                  {l}
                </label>
              ))}
            </fieldset>
          ))}
          <input
            aria-label="เหตุผลเปลี่ยนสิทธิ์"
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เหตุผล"
          />
          {message ? <p role="status">{message}</p> : null}
          <Button
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/admin/users/${user.id}/permissions`, {
                  method: "PUT",
                  json: { staffRole: role, modulePermissions: grants, reason },
                });
                setMessage("บันทึกสิทธิ์แล้ว มีผลกับคำขอถัดไปทันที");
              } catch (e) {
                setMessage(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            บันทึกสิทธิ์โมดูล
          </Button>
        </div>
      ) : null}
    </div>
  );
}
