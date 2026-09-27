// Preloaded (`node --import`) by the dev-only scripts `dev` and `db:seed`: the API fails closed on an
// unset NODE_ENV (treated as production, so the public dev JWT secret is refused), and neither
// Windows shells nor POSIX ones share a syntax to set a variable inline. A NODE_ENV already present —
// from the shell or from `--env-file` (loaded before any preload) — wins.
process.env.NODE_ENV ??= 'development';
