// Instant navigation feedback for the news index only (a route group keeps it
// off /news/[slug], where it flushed a 200 before notFound() → soft 404s).
export { default } from "../../(home)/loading";
