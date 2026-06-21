"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Wraps the main column content so it gently fades/rises in on route changes,
 * WITHOUT animating the surrounding shell. Keying on the pathname remounts the
 * inner node on navigation, re-triggering the CSS enter animation. The sidebar
 * and rail live outside this wrapper, so they stay put (no flash) as you move
 * between pages. Honors prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in motion-reduce:animate-none">
      {children}
    </div>
  );
}
