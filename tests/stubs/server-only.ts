// Vitest stand-in for the "server-only" package: the real module throws when a
// non-server bundle imports it, which kills any unit test whose import chain
// touches lib/supabase/server.ts. Aliased in vitest.config.ts.
export {};
