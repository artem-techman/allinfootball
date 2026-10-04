import { AppShell } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/primitives/Skeleton";

/**
 * Instant navigation feedback. Pages are rendered on demand, so without this a
 * sidebar click showed nothing until the whole next page arrived. Next prefetches
 * this shell for every link and swaps it in immediately: same sidebar, with
 * placeholder blocks where the content is loading.
 */
export default function Loading() {
  return (
    <AppShell>
      <div aria-busy="true" aria-label="Loading" className="space-y-5 pt-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </AppShell>
  );
}
