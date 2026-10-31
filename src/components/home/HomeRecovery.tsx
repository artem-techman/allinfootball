"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When the home page was built while football data briefly failed (upcoming
 * matches, scorers or the visitor's club came back empty), refresh it once a
 * couple of seconds later instead of leaving the sections blank until a manual
 * reload (2026-10-31). At most twice a minute, so a real outage can't loop.
 */
export function HomeRecovery({ missing }: { missing: string[] }) {
  const router = useRouter();
  const key = missing.join(",");
  useEffect(() => {
    if (!key) return;
    try {
      const k = "mft-home-heal";
      const recent = (JSON.parse(sessionStorage.getItem(k) ?? "[]") as number[]).filter((t) => Date.now() - t < 60_000);
      if (recent.length >= 2) return;
      sessionStorage.setItem(k, JSON.stringify([...recent, Date.now()]));
    } catch {
      return;
    }
    const t = setTimeout(() => router.refresh(), 2_500);
    return () => clearTimeout(t);
  }, [key, router]);
  return null;
}
