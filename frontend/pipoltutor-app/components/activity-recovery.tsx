"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { replayActivities } from "@/lib/activity-journal";

/** Recover duration-only evidence after a reload or an automatic submission. */
export function ActivityRecovery({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    const retry = () => { if (navigator.onLine) void replayActivities(attemptId).then(changed => { if (changed && !disposed) router.refresh(); }); };
    retry();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, 15000);
    return () => { disposed = true; window.removeEventListener("online", retry); clearInterval(timer); };
  }, [attemptId, router]);
  return null;
}
