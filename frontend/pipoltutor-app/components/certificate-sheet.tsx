"use client";

import { useEffect, useState } from "react";

import { certificateFileUrl } from "@/lib/certificate-file";
import type { CertificateStatus } from "@/lib/certificates";
import { Icon } from "./ui";

/**
 * The server-rendered certificate image. While the render job is still
 * queued the file route answers 409, so this polls and says so honestly
 * instead of showing a broken image (CERT-07).
 */
export function CertificateSheet({ id, status, alt, className = "" }: { id: string; status: CertificateStatus; alt: string; className?: string }) {
  const [ready, setReady] = useState(status !== "pending");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (ready || tries > 40) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(certificateFileUrl(id, "png"), { cache: "no-store" });
        if (res.ok) return setReady(true);
      } catch {
        // Offline or restarting; try again.
      }
      setTries((n) => n + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [id, ready, tries]);

  if (ready) {
    // eslint-disable-next-line @next/next/no-img-element -- private file behind the session cookie
    return <img src={certificateFileUrl(id, "png")} alt={alt} className={`block h-auto w-full bg-white ${className}`} />;
  }
  return (
    <div role="status" className={`flex aspect-[2000/1414] w-full flex-col items-center justify-center gap-2 bg-white text-center text-[#46557a] ${className}`}>
      <Icon name="workspace_premium" size={38} className="motion-safe:animate-pulse" />
      <span className="px-4 text-[14px]">{tries > 40 ? "ยังสร้างเกียรติบัตรไม่เสร็จ ลองโหลดหน้านี้ใหม่อีกครั้ง" : "กำลังสร้างเกียรติบัตร…"}</span>
    </div>
  );
}
