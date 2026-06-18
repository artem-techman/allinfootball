import type { ReactNode } from "react";

type PillTone = "lime" | "dark" | "live" | "neutral" | "minute";

const TONES: Record<PillTone, string> = {
  lime: "bg-accent-lime text-text-on-accent",
  dark: "bg-surface-dark-2 text-text-on-dark",
  live: "bg-live-red text-text-on-dark",
  minute: "bg-transparent text-live-minute",
  neutral: "bg-white/8 text-text-secondary",
};

/** Full-radius pill. Used for status chips, LIVE badge, live minute, etc. */
export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Form result pill (W/D/L) used in standings (section 8). */
export function FormPill({ result }: { result: "W" | "D" | "L" }) {
  const tone =
    result === "W"
      ? "bg-live-minute text-text-on-dark"
      : result === "L"
        ? "bg-live-red text-text-on-dark"
        : "bg-hairline text-text-secondary";
  return (
    <span
      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${tone}`}
      aria-label={result === "W" ? "Win" : result === "L" ? "Loss" : "Draw"}
    >
      {result}
    </span>
  );
}
