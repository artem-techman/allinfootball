import type { ReactNode } from "react";

/** Distinct empty states per context (CLAUDE.md section 10). Never a blank box. */
export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-tile border border-dashed border-hairline px-6 py-10 text-center">
      {icon && <div className="mb-1 text-text-secondary">{icon}</div>}
      <p className="text-cardtitle text-text-primary">{title}</p>
      {hint && <p className="text-meta text-text-secondary">{hint}</p>}
    </div>
  );
}
