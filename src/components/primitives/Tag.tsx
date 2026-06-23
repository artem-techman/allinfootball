import type { ReactNode } from "react";

/** Small label tag (e.g. "UCL SEMI FINAL" on the hero card). Lime by default. */
export function Tag({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: "lime" | "soft" | "onDark";
}) {
  const cls =
    tone === "onDark"
      ? "bg-surface-dark-2 text-accent-lime"
      : tone === "soft"
        ? "bg-accent-lime-soft text-accent-lime"
        : "bg-accent-gradient text-text-on-accent";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.04em] ${cls}`}
    >
      {children}
    </span>
  );
}
