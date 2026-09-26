# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Live quiz app. pnpm monorepo, TypeScript strict end-to-end.
Three roles: admin back-office (`/admin`), projected presenter view (`/present/:sessionId`), mobile participants (`/j/:code`).

Repo root for all commands is `quiz-interactif/` (the parent folder `quiz-app/` only wraps it).

## Commands

```bash
pnpm install
cp apps/api/.env.example apps/api/.env                  # DATABASE_URL -> file:../data/quiz.db
pnpm --filter @quiz/api db:migrate                      # creates apps/api/data/quiz.db, migrate + generate client
pnpm --filter @quiz/api db:seed                         # first admin
pnpm dev                                                # api :3000 + web :5173 (vite proxies /api, /uploads, /socket.io)
```

```bash
pnpm typecheck                     # tsc --noEmit in every package
pnpm lint                          # eslint . && prettier --check .
pnpm format                        # prettier --write .
pnpm test                          # vitest run, all packages
pnpm build                         # all packages; web build runs tsc --noEmit first
pnpm --filter @quiz/shared test    # pure business rules (fastest loop, no DB)
pnpm --filter @quiz/api test       # integration tests, no DB server needed (throwaway SQLite file, recreated each run)
pnpm --filter @quiz/web test:e2e   # playwright
pnpm docs:protocol                 # regenerate docs/PROTOCOL.md from the Zod schemas
pnpm mock:live                     # socket mock server on 127.0.0.1:4001 (MOCK_HOST=0.0.0.0 to expose it); run web with MOCK=1 to target it
pnpm --filter @quiz/api check:scores     # audit: stored scores vs SUM(answers)
node apps/api/test/load-smoke.mjs 200    # load smoke, see docs/LOAD.md
node apps/api/test/live-smoke.mjs        # live engine end-to-end, needs the API running on :3000
```

Single test file: `pnpm --filter @quiz/shared exec vitest run test/scoring.test.ts` (add `-t "name"` for one case).

Node 22 (`.nvmrc`), pnpm 12 (`packageManager: pnpm@12.3.4+sha512.…` — corepack verifies the hash, so a version bump needs the new hash too). **There is no CI workflow in the repo** (no `.github/`): the gate is local, in this order — `prisma:generate`, `typecheck`, `lint`, `test`, `build`, then the two `deploy/Dockerfile.*` builds before a release.

Trunk (`.trunk/trunk.yaml`, launcher `./trunk.ps1`, root script `pnpm trunk`) carries the extra linters on top of `pnpm lint` — hadolint, shellcheck/shfmt, markdownlint, yamllint, taplo, checkov, grype, osv-scanner, trufflehog — and enables the `trunk-fmt-pre-commit` and `trunk-check-pre-push` actions. Its `ignore` list mirrors `.prettierignore`/`eslint.config.js` (`.claude/`, the vendored kit's `.jsx` and `.prompt.md`); keep the three in sync when you add an exclusion.

`pnpm-workspace.yaml` declares `allowBuilds` (`argon2`, `sharp`, `prisma`, `@prisma/client`, `@prisma/engines`, `esbuild`): pnpm 12 runs **no** install script unless the package is listed, so a new native dependency needs an entry or it installs unbuilt. It also pins a `deepmerge-ts: ^8.0.2` override (GHSA-ggr8-5vv4-36mx, outside the `^7` range `@prisma/config` declares).

## Architecture

`packages/shared` is the single contract — **read it before touching api or web**. Zero Node/DOM imports.

- `schemas/domain.ts`, `schemas/rest.ts`, `schemas/events.ts` — Zod schemas used for server-side validation (422/400) _and_ client-side form errors. `docs/PROTOCOL.md` is **generated** from them; never hand-edit it.
- `scoring.ts`, `state-machine.ts`, `nickname.ts`, `numeric.ts`, `text.ts`, `stats.ts`, `projections.ts`, `errors.ts` — pure functions, no I/O, exhaustively unit-tested. API and mock-server consume the same functions, so mock and reality cannot diverge.
- `constants.ts` — every validation bound (code alphabet, nickname length, points range, `GRACE_MS`, upload caps, password max length, resume-token bounds, per-IP socket cap, multipart and decoded-pixel limits…). Add limits here, not inline.

Business-rule changes belong in `packages/shared` with a test; the API and the web app should only wire them.

`apps/api` — Fastify 5 + Prisma/SQLite, ESM, `.js` extensions in relative imports.

- The database is a plain SQLite file via Prisma's native connector (`provider = "sqlite"`): no DB container, dev or prod. `DATABASE_URL` is `file:../data/quiz.db?connection_limit=1` in dev (Prisma resolves relative SQLite paths from `apps/api/prisma/`, so the file is `apps/api/data/quiz.db`) and `file:/data/db/quiz.db?connection_limit=1` in the production container, on a named Docker volume. `connection_limit=1` serialises writes at the Prisma pool level: no `SQLITE_BUSY`, and session PRAGMAs actually stick (`journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, applied at startup).
- SQLite has no `enum`: `QuestionType`, `MediaKind` and `SessionPhase` are `String` columns. The Zod schemas in `packages/shared` remain the validation source of truth. `Json` columns are still supported (stored as TEXT); no query looks inside them (the quiz-lock guard only compares `playedQuestionIds` as a whole).

- `prisma.config.ts` is the Prisma config — the `prisma` key in `apps/api/package.json` is gone. It pins `prisma/schema.prisma` **and** loads `apps/api/.env` itself through `process.loadEnvFile`: the mere existence of a config file disables Prisma's own `.env` auto-loading, so dropping that call makes every `prisma` CLI command lose `DATABASE_URL`.
- Tests never read `.env`. `apps/api/vitest.config.ts` forces `NODE_ENV=test` and `DATABASE_URL=file:../data/test.db?connection_limit=1`, and the `pretest` script `scripts/reset-test-db.mjs` deletes `data/test.db{,-wal,-shm}` then runs `prisma migrate deploy` against that same URL. A fresh clone, a worktree or a container with no `apps/api/.env` still runs `pnpm --filter @quiz/api test`, and the suite can never touch the dev database.
- `app.ts` builds the app without listening, so tests use `fastify.inject()`. REST is mounted under `/api/v1`; `/uploads` is static; health is unprefixed. Its error handler keeps Fastify's own 4xx answers but turns every 5xx into the generic `INTERNAL` envelope — the real message is only logged. `trustProxy` is `trustCaddyHop` (`lib/proxy.ts`): exactly one hop, trusted only from a loopback/private peer, so a client-supplied `X-Forwarded-For` never chooses its rate-limit bucket; socket handshakes key their per-IP limits on the same rule (rightmost XFF entry).
- `plugins/csrf.ts` guards every unsafe `/api` method (POST/PUT/PATCH/DELETE): 403 `FORBIDDEN` on `Sec-Fetch-Site: cross-site|same-site`, or on an `Origin` other than `PUBLIC_URL`'s (plus its loopback aliases, outside production only). A request with neither header (curl, smoke scripts, `inject`) passes.
- `plugins/auth.ts`: HS256 access JWTs with pinned `iss`/`aud`, required `sub`/`iss`/`aud`/`exp`, a random `jti` and a `pca` claim copying `Admin.passwordChangedAt` (ms). `app.verifyAccessToken` is **the** check — the REST guard and the `/presenter` handshake both go through it: signature, expiry, logout list, `isActive`, and `pca`, so a password change refuses every earlier token at once. Logout also revokes the current access JWT (in-memory list). A refresh replayed inside the rotation grace gets an access token only, never a second refresh token. Nobody resets a colleague's password: `AdminPatchInput` is `.strict()` and has no `password`.
- `config.ts` validates `process.env` with Zod at startup and throws on bad env; outside production it falls back to the public dev JWT secret and logs a warning.
- `modules/live/SessionManager.ts` is the real-time engine: hot in-memory state, **one `async-mutex` per session**, transactional persistence (`prisma.$transaction` writes before broadcast), re-armable timers (auto-close cancelled by a manual close), and `getOrLoad(sessionId)` rebuilding in-memory state from `LiveSession` + its `participants` and `answers` after a restart (there is no event log table). Any live mutation must go through it under the session lock. An answer is bound to the opening it was sent to (`questionOpenedAt`): one queued behind a close + reopen, or a next, is refused `QUESTION_CLOSED`. A join on an `ENDED` session is refused from the row, without loading it; `deleteSession` keeps `getOrLoad` from rebuilding the session while it runs.
- `plugins/live.ts` wires socket.io namespaces `/participant` and `/presenter`, auth middlewares, per-socket token buckets, and ack-based commands parsed with the shared command schemas. `allowRequest` refuses a handshake whose `Origin` is not in the CSRF guard's set (no `Origin` = non-browser client, allowed) — testing from a LAN address in dev therefore needs `PUBLIC_URL` set to that address. Handshake auth is schema-checked (resume token outside the `PARTICIPANT_TOKEN_*` bounds → `TOKEN_INVALID`; non-UUID presenter `sessionId` → `SESSION_NOT_FOUND`), presenter ownership is read from the row before `getOrLoad`, `/participant` sockets are capped per IP (`MAX_PARTICIPANT_SOCKETS_PER_IP`), and every presenter command, `session:end` and `settings:update` included, is rate-limited. The guards live in `modules/live/socket-guards.ts`.
- Commands carry `expectedIndex` for idempotence — a double-clicked presenter command is ignored, not replayed.

`apps/web` — React 19 + Vite 7, react-router 7, Zustand for live state, `lib/api-client.ts` (fetch + Zod, 401 → refresh → retry) for REST.

- Build every API path with the `apiPath` tagged template of `lib/api-client.ts` (``apiPath`/quizzes/${id}/sessions` ``): each interpolated value is percent-encoded as one segment, so a route param can never retarget the request. Never concatenate a param into a URL.
- An explicit logout (`AdminLayout`) clears every `quiz:draft:*` editor draft (`clearAllDrafts`: a draft holds the correct answers); a forced 401 keeps them on purpose, so an expired session does not lose work.

- Live stores (`features/participant`, `features/presenter`) are fed **only** by `state:snapshot` + events; never reconstruct state client-side. Timers use `clockOffset` derived from `serverTime`.
- **The UI is multilingual (FR default, EN)** — `src/i18n/`. react-i18next, bootstrapped once from `main.tsx`. Dictionaries are TS modules under `locales/<lng>/<ns>.ts`, one namespace per surface (`common`, `participant`, `presenter`, `admin`), dynamic-imported by `i18next-resources-to-backend` so Vite emits one chunk per (language, namespace): a phone never downloads the admin strings. Language is **per viewer**, never per session: `navigator.language` then the `quiz.lang` `localStorage` key, switched by `components/LanguageSwitcher.tsx` (light-ground participant header, stage lobby, admin bar, login). `i18n.on('languageChanged')` keeps `<html lang>` aligned. Adding a language = a folder under `locales/` + one entry in `i18n/languages.ts`.
- Strings live in the dictionaries, never inline. `<Trans components={{ num: <Num /> }}>` is how a sentence keeps its mono digits (`<num>` in the dictionary) while letting a translation move the number. Plural keys hold the **noun alone** (`_one` / `_other`) when the screen renders the number itself. `apps/web/test/i18n.test.ts` fails the build if `fr/` and `en/` drift on keys, empties or `{{placeholders}}` — a missing key does not throw, it silently falls back to French.
- `lib/format.ts` (it replaced `format-fr.ts`) is the single number/date formatter: `Intl` bound to the active language, `NBSP`, the real minus U+2212, `ordinalSuffix` via `Intl.PluralRules`. `punctuationSpace()` is the FR-only space before `? ! : %`. Never `toLocaleString('fr-FR')` in a screen.
- `src/design-system/` is a vendored kit: `.jsx` components with co-located `.d.ts` contracts and `.prompt.md` docs, CSS tokens under `tokens/`. The ESLint config carries a `design-system/**` ignore entry and `.prettierignore` excludes the same files — do not rewrite or reformat them. **Every deliberate deviation from the source kit is listed in `src/design-system/README.md`, lot by lot: read it before touching a component, and add a line there when you patch one.** The local `.tsx` files (no equivalent in the kit) are `core/Icon` (lucide-react named imports, no CDN), `core/Wordmark`, `quiz/StageFrame`, `quiz/Podium` and `motion/CountUp`. `quiz/Podium` is the one file there that calls `useTranslation`; the vendored `Timer.jsx` keeps its French `aria-label` and the callers override it through `{...rest}` instead.
- Two fixed grounds, no theme toggle and no `data-theme`: the light app (`--surface-page`) and the dark stage (`--stage-bg`). `lib/useThemeColor.ts` keeps `<meta name="theme-color">` on the active one. Fonts are self-hosted (`@fontsource`); keep it CSP-friendly and CDN-free.
- Screens live per surface: `pages/participant/` (join, lobby, round result, final, terminal states + the `LightShell` / `StageShell` templates), `pages/presenter/` (`Stage*.tsx` + `stage-shared.tsx`), `pages/admin/` and `pages/admin/editor/` (panes of the quiz editor). `features/shared-live/QuestionCard.tsx` is rendered on the stage ground for both the participant and the editor preview, so the preview cannot drift.
- Routes are lazy/code-split, participant path first; the two end-of-run participant screens are lazy too. Nothing from `Tabs`, `Podium` or `@dnd-kit` may enter the entry chunk — check `pnpm --filter @quiz/web build` after touching the participant path. i18next + react-i18next **are** in that chunk (they are needed on first paint): it went from 442 kB to 515 kB raw, 136 kB to 160 kB gzip. The dictionaries themselves are not — they are separate chunks of one to four kB.
- `e2e/` is the visual harness, not a regression suite: `screens`, `participant`, `stage`, `reduced-motion` (mock — `pnpm mock:live` + `MOCK=1 pnpm --filter @quiz/web dev`), `admin` and `editor` (real API + seeded admin). They write `docs/screens/<surface>/<state>-<viewport>.png` and fail on any console error; `e2e/helpers.ts` holds the viewports and `e2e/mock-driver.ts` the presenter/bot driver.

`deploy/` is the whole production story: `Dockerfile.api` (esbuild bundle + Prisma engines, entrypoint `api-entrypoint.sh` running `prisma migrate deploy` then the idempotent seed — no fallback: a seed failure stops the container), `Dockerfile.web` (Vite build served by Caddy), `Caddyfile`, `docker-compose.yml` (named volumes `dbdata` → `/data/db`, `uploads` → `/data/uploads`, plus Caddy's) and `.env.example` (`DOMAIN`, `PUBLIC_URL`). There is no DB service in the compose file — SQLite is a file on `dbdata`.

- Base images are pinned by tag **and** sha256 digest; the bump procedure is commented at the top of each Dockerfile. `Dockerfile.api` needs BuildKit (`COPY --chmod`). `.dockerignore` keeps every `.env.*` except `.env.example` out of the build context.
- The `Caddyfile` sets the security headers on every route (HSTS, nosniff, `no-referrer`, `X-Frame-Options DENY`, COOP, Permissions-Policy, no `Server`), a strict CSP on `/api` (`sandbox allow-downloads`, for the CSV/JSON exports) and on `/uploads`, and `request_body` caps. The `/api` cap (16 MiB) is sized on `UPLOAD_MAX_AUDIO_MB`: raising that constant means raising the Caddy cap.

## Invariants to preserve

- **No answer leaks.** `toParticipantQuestionView()` in `shared/projections.ts` is the only boundary that strips `isCorrect`, `numericAnswer`, `correctChoiceId`. Participant payloads (REST and socket) must pass through it; a unit non-leak test plus an API integration test guard this.
- **Individualised feedback.** Acks and `question:closed` carry only that participant's result (rank, points), never other participants' detail. While a question is open, a participant snapshot's score and rank leave that question's points out (`buildVisibleRanking` in `shared/stats.ts`), so a resume cannot reveal correctness before `question:closed`; the presenter keeps the live ranking. The one aggregate exception is `textEntries` on a `TEXT_POLL` round result: the same grouped, anonymous answers the stage projects (`buildTextDistribution`), never who wrote what.
- **Played quizzes are frozen.** The transactional quiz PUT rejects deleting/reordering/retyping a question or changing its correct answer once played (`423 QUIZ_LOCKED`); duplication is the escape hatch. Played survives session deletion: `DELETE /sessions/:id` ends a running session first, then records its answered questions in `Quiz.playedQuestionIds` before the answers cascade away (`modules/quizzes/played.ts`). The save transaction re-asserts the lock in its first statement, so a session started, answered or deleted meanwhile rolls the save back with a 423.
- **Auth.** Argon2id passwords, every password field (login included) capped at `ADMIN_PASSWORD_MAX_LENGTH` (256); 15-min access JWT in httpOnly cookie `access_token`, refused at once after a logout, a deactivation or a password change; opaque 7-day rotating `refresh_token` (single use, reuse ⇒ theft detection). Login errors stay undifferentiated. Unsafe REST methods pass the CSRF guard, socket handshakes the Origin check.
- **Uploads.** Type detected by magic bytes (never the extension), images re-encoded to WebP via sharp (`limitInputPixels` = `IMAGE_MAX_INPUT_PIXELS`, 40 MP), multipart bounded by the `UPLOAD_MULTIPART_*` constants, UUID filenames, stored outside the DB. The media routes' auth hook is unconditional — never a `req.url` test.
- **CSV exports are formula-safe.** `formulaSafe` prefixes authored text whose first significant character (after blanks, control or zero-width characters) is a formula trigger, full-width forms included; `csvCell` quotes `;`, `,`, tab, quotes and line breaks.
- **Answer boxes are visually identical** across choices — the A–F letter is the only distinguishing marker (accessibility: no colour coding).

Single API process — now definitive: live state is in memory _and_ SQLite is a single-writer file on one machine. This caps processes, not sessions: `SessionManager` holds a Map of sessions with a per-session mutex and per-session timers, so many concurrent live sessions in the one process are fine. Multiple API processes/machines are closed off (sticky sessions or a Redis adapter would not be enough — the file would still be single-writer); libSQL would be the way out if that need ever appears.

## Conventions

- TS strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`: use `import type`, handle possibly-undefined index access.
- ESLint: `no-explicit-any` is an **error**; `console.log` warns (`warn`/`error` allowed).
- Prettier: 110 cols, single quotes, semicolons, trailing commas. `.prettierignore` holds `.claude/`, the vendored kit and the generated files (`docs/PROTOCOL.md`, `docs/quiz-import-schema.json`, `pnpm-lock.yaml`) — reformatting them would break the next `pnpm docs:protocol`.
- `.gitattributes` pins `* text=auto eol=lf`: the repo stores LF and every checkout gets LF, so Prettier (`endOfLine: lf`) passes on a fresh Windows worktree without a rewrite pass.
- Docs are French, and French is the UI's default and fallback language — but user-facing strings are **not** written inline any more: they belong in `apps/web/src/i18n/locales/<lng>/`, and every French key needs its English counterpart. Code, comments and identifiers stay English. CSV exports and the API's own error messages are still French only (server-side; out of the UI i18n).
- FR typography is enforced in the French dictionaries: non-breaking space before `? ! : %` and between a number and its unit — use `NBSP` from `src/lib/format.ts`, never a literal U+00A0 (`no-irregular-whitespace` only spares string literals). English carries no such space: do not copy the FR spacing into `en/`. Sentence case everywhere, capitals reserved to `--text-overline`; infinitives, `vous`, no emoji, no unicode glyph standing in for an icon, all UI digits in `--font-mono`.
- Section refs in comments (`§4.3`, `§6.2`) point at the original spec and map onto `docs/PROTOCOL.md`.
- `docs/` ships `PROTOCOL.md` (generated), `quiz-import-schema.json` (generated) and `LOAD.md`. `docs/internal/` is **gitignored** — local-only `ARCHITECTURE.md`, the UX redesign plan and a screens archive — so never point committed code or docs at a path under it. The e2e harness writes to `docs/screens/`, which is a separate, untracked output directory.

## Known rough edges

- Root script `load-test` references `tools/load-test/run.mjs`, which does not exist (`tools/*` is declared in `pnpm-workspace.yaml` but absent). Use `apps/api/test/load-smoke.mjs`.
- `tsc` never emits here: `noEmit: true` is inherited from `tsconfig.base.json` and `@quiz/shared` exports `./src/index.ts`. `typecheck` is the type gate; the real build is `pnpm --filter @quiz/api build`, which runs esbuild (`apps/api/scripts/build.mjs`) and emits `dist/server.js` + `dist/prisma-seed.js` with `@quiz/shared` bundled in and every installed dependency external.
- Accepted trade-offs of the auth hardening: a logout does not disconnect presenter sockets already open (no way to target one device) — they stay up until they drop, and their next handshake is refused; the logged-out access-token list lives in memory, so a restart forgets it (fine with a single process: the cookies are already cleared and the JWT expires within 15 min); a refresh-rotation response lost in transit and retried inside the grace window only gets an access token, so that browser signs in again when it expires.
- Docker images copy `pnpm-lock.yaml` **and every workspace manifest** (including `apps/web/package.json` for the API image): `pnpm-workspace.yaml` declares `apps/*`, so a missing member makes the lockfile look stale and `--frozen-lockfile` fails. `--filter <pkg>...` keeps the install narrow. Do not reintroduce a `|| pnpm install` fallback — it silently turns a frozen install into an unpinned one.
