// Central query-key registry. Hooks read keys from here — never inline arrays — so a
// mutation's invalidation list and a query's own key can't silently drift. Every domain
// exposes `all()`, the bare `[domain]` prefix: TanStack Query matches keys by prefix, so
// `invalidateQueries({ queryKey: qk.someDomain.all() })` sweeps every `['some-domain', ...]`
// entry at once.
//
// EXTENSION POINT (modules): add one key family per domain as it's wired (Sub-02).
export const qk = {
  auth: {
    all: () => ["auth"] as const,
    // No server "who am I" endpoint — this key just caches the locally-derived Session
    // (see hooks/useSession.ts, types/session.ts) in TanStack Query so every consumer
    // reads the same value instead of re-decoding the JWT on every render.
    session: () => ["auth", "session"] as const,
  },
} as const;
