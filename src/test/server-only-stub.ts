// Vitest stub for the `server-only` package. In the app this import makes a
// module fail the build if it is ever pulled into a client bundle (protecting
// FOOTBALL_API_KEY). Under Vitest (plain Node) we alias it to this no-op so the
// pure mapper functions can be unit-tested directly.
export {};
