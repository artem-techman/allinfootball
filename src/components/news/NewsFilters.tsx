import Link from "next/link";
import { COMPETITIONS } from "@/lib/constants/competitions";

/** Scrollable filter chips for the news river: All · nine competitions · Transfers. */
export function NewsFilters({ active }: { active: string }) {
  const chips = [
    { key: "all", label: "All", href: "/news" },
    ...COMPETITIONS.map((c) => ({ key: c.slug, label: c.name, href: `/news?comp=${c.slug}` })),
    { key: "transfers", label: "Transfers", href: "/news?tag=transfers" },
  ];

  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {chips.map((c) => {
        const isActive = c.key === active;
        return (
          <Link
            key={c.key}
            href={c.href}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-meta font-semibold transition-colors ${
              isActive
                ? "border-accent-lime bg-accent-lime text-text-on-accent"
                : "border-hairline bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {c.label}
          </Link>
        );
      })}
    </div>
  );
}
