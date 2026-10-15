import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/primitives/Skeleton";

/**
 * Instant navigation feedback — scoped to home (and re-exported by /feed,
 * /news, /my-club). NOT at the app root: a root boundary sends the response
 * (status 200) before a page can call notFound(), turning every unknown match,
 * team or date into a "soft 404".
 *
 * Instant navigation feedback. Pages are rendered on demand, so without this a
 * sidebar click showed nothing until the whole next page arrived. Next prefetches
 * this shell for every link and swaps it in immediately: same sidebar, with
 * placeholder blocks where the content is loading.
 */
function Placeholder() {
  return (
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
  );
}

export default function Loading() {
  // The sidebar reads useSearchParams(), which needs its own Suspense boundary
  // wherever this shell is prerendered (it broke the static /_not-found build).
  return (
    <Suspense fallback={<Placeholder />}>
      <AppShell>
        <Placeholder />
      </AppShell>
    </Suspense>
  );
}
