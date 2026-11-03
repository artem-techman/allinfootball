"use client";

import { useEffect } from "react";

/**
 * A fan who picked their club before we kept records (it lived only in their
 * browser) reports it once, so the club count includes them. Sends nothing
 * without a club; remembers per club so it never repeats.
 */
export function ClubSeenBeacon() {
  useEffect(() => {
    try {
      const raw = document.cookie.split("; ").find((c) => c.startsWith("mft_club="));
      if (!raw) return;
      const club = JSON.parse(decodeURIComponent(raw.slice("mft_club=".length))) as { id?: number };
      if (!club.id || localStorage.getItem("mft_club_seen") === String(club.id)) return;
      fetch("/api/club/seen", { method: "POST" })
        .then((r) => r.ok && localStorage.setItem("mft_club_seen", String(club.id)))
        .catch(() => {});
    } catch {
      /* storage blocked or a malformed cookie: nothing to report */
    }
  }, []);
  return null;
}
