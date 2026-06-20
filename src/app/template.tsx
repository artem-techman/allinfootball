import type { ReactNode } from "react";

/**
 * App Router re-instantiates this template on every navigation (unlike layout,
 * which persists), so it's where we run a per-page enter animation. The page
 * content fades and rises in briefly on each route change for a smoother feel;
 * disabled under prefers-reduced-motion.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in motion-reduce:animate-none">{children}</div>;
}
