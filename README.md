# Quizint

![Quizint](apps/web/public/quizint.png)

[Version française](README.fr.md)

Full-featured live quiz application: authoring back-office, projected presenter screen, participants on mobile. pnpm monorepo, strict TypeScript end-to-end.

## Demo

[Try the demo](https://quizint.yajusta.fr/admin/login)

## Getting Started (4 commands)

```bash
pnpm install                                            # dependencies
cp apps/api/.env.example apps/api/.env                  # config
pnpm --filter @quiz/api db:migrate                      # migration + first admin seed
pnpm dev                                                # api :3000 + web :5173
```

Default credentials: `admin@example.fr` / `admin-password-12` (from seed — change upon setup).

> No database service to launch: the database is a SQLite file (`apps/api/data/quiz.db`) created automatically by the migration, which creates the tables; the seed creates the initial admin user (§5.1), with the `ADMIN` role.

Accounts have a role: `ADMIN` creates accounts, changes roles, deactivates and resets other accounts' passwords; `USER` (the default for a new account) manages only its own quizzes, sessions and password. Quizzes and sessions stay private to their owner whatever the role. At least one active `ADMIN` always remains.

## User Journeys

| Role        | Route                 | Description                                                                        |
| ----------- | --------------------- | ---------------------------------------------------------------------------------- |
| Participant | `/`                   | Enter 6-character code                                                             |
| Participant | `/j/:code`            | Nickname → questions → personalized results → podium                               |
| Admin       | `/admin/login`        | Login (JWT httpOnly cookies)                                                       |
| Admin       | `/admin`              | Dashboard: quizzes, active sessions, JSON import                                   |
| Admin       | `/admin/quizzes/:id`  | Editor: 4 question types, media, participant preview                               |
| Admin       | `/admin/sessions`     | History, stats, CSV exports                                                        |
| Admin       | `/admin/admins`       | Accounts: an ADMIN manages every account, a USER changes its own password          |
| Presenter   | `/present/:sessionId` | Projected view: QR + code, timer, gauges, bar charts, podium (Space/F/P shortcuts) |

## Commands

```bash
pnpm -r typecheck        # strict TypeScript everywhere
pnpm -r test             # vitest (shared business rules + API integration)
pnpm --filter @quiz/web build    # production build (route-based code-splitting)
pnpm --filter @quiz/api dev      # API in watch mode
pnpm --filter @quiz/api test     # API integration tests (disposable SQLite DB, recreated on each run)
pnpm --filter @quiz/api check:scores  # score consistency check vs SUM(answers)
node apps/api/test/load-smoke.mjs 200  # load smoke test (see docs/LOAD.md)
pnpm --filter @quiz/shared mock:live    # protocol mock server (frontend dev), 127.0.0.1 only unless MOCK_HOST is set
pnpm --filter @quiz/shared docs:protocol # regenerate docs/PROTOCOL.md
pnpm --filter @quiz/web test:e2e        # Playwright screenshots -> docs/screens/<surface>/
```

Screenshots are captured against manually started servers: `pnpm mock:live` + `MOCK=1 pnpm --filter @quiz/web dev` for participant, stage, and `prefers-reduced-motion`; normal API and web (seeded account) for the back-office and editor.

## Code Quality Checks with Trunk

[Trunk](https://docs.trunk.io/cli) runs all repository linters and formatters in one pass (ESLint, Prettier, shellcheck, shfmt, hadolint, yamllint, markdownlint, taplo, checkov, grype, osv-scanner, trufflehog, oxipng). Versions are pinned in `.trunk/trunk.yaml` and the binary downloads automatically on first execution: nothing to install manually.

```bash
pnpm run trunk -- upgrade                # updates trunk, its plugins, and linter versions
pnpm run trunk -- fmt --all              # formats the entire repository (writes files)
pnpm run trunk -- check --all --no-fix   # analyzes the entire repository without modifying anything
```

The `--` delimiter is required: without it, pnpm consumes the arguments instead of passing them to the runner. The `trunk` script in `package.json` calls `trunk.ps1` (Windows); on macOS or Linux, use `./trunk upgrade`, `./trunk fmt --all`, etc.

Typical workflow: run `upgrade` periodically, then `fmt --all`, then `check --all --no-fix`, which should exit with zero diagnostics.

- **`upgrade`** updates `.trunk/trunk.yaml` (linter, runtime, and CLI versions): review the diff and commit it. `--dry-run` lists available updates without applying them; a scope (`trunk upgrade check`, `plugins`, `runtimes`, `tools`, `cli`) narrows the update target.
- **`fmt --all`** rewrites files. Review `git diff` before committing: the vendored design system (`apps/web/src/design-system/**`) and generated files (`docs/PROTOCOL.md`, `docs/quiz-import-schema.json`, `pnpm-lock.yaml`) are excluded by `.prettierignore` and must remain untouched — if they show up in the diff, revert the regression.
- **`check --all --no-fix`** runs a read-only check: `--all` scans the entire repository instead of only modified files, and `--no-fix` prevents automatic rewriting. This is the command to use prior to committing or in CI, where a failure is expected rather than a silent auto-fix.

`trunk` complements `pnpm lint` and `pnpm typecheck` without replacing them: type checking remains enforced by `tsc --noEmit`.

## Architecture

```text
packages/shared     Single contract: Zod schemas (domain, REST, socket events),
                    pure business rules 100% tested (scoring, state machine,
                    nicknames, stats).
                    mock-server: replays protocol §6 to develop the frontend without the API.
apps/api            Fastify + Prisma (SQLite). Modules: auth (argon2 + JWT cookies
                    + rotating refresh tokens), quizzes (transactional, locking),
                    media (magic bytes + sharp WebP), sessions (frozen snapshot), live
                    (SessionManager: hot state, resettable timers, per-session lock),
                    CSV exports (BOM, FR decimal format).
apps/web            React 19 + Vite. Vendored design system (tokens, .jsx components;
                    deviations documented in src/design-system/README.md), self-hosted
                    fonts — zero CDN, CSP-friendly. Two fixed themes without toggles:
                    light app, dark stage. Screens grouped by surface (pages/participant,
                    pages/presenter, pages/admin, pages/admin/editor); e2e/ captures every
                    state into docs/screens/<surface>/.
deploy/             Production Compose, multi-stage Dockerfiles, Caddy (auto TLS, gzip,
                    reverse proxy /api /socket.io /uploads).
docs/               PROTOCOL.md (generated), LOAD.md, JSON import schema.
```

Detailed architectural decisions: `docs/ARCHITECTURE.md`. Real-time protocol: `docs/PROTOCOL.md`.

## Production

```bash
cd deploy
cp .env.example .env   # DOMAIN, JWT_SECRET, admin seed
docker compose up -d --build
```

`JWT_SECRET` signs the admin JWTs: generate it with `openssl rand -base64 48` (or `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`). The API refuses to start without it, with the template value, or with an obviously weak secret (under 32 bytes, fewer than 8 distinct characters, a repeated pattern). The public development secret is only accepted when `NODE_ENV` is explicitly `development` or `test`: an unset `NODE_ENV` counts as production (`pnpm dev` and `db:seed` set `development` themselves).

Upgrading an existing deployment: migration `20260926130000_refresh_token_credential_version` binds each refresh token to the admin's credential version and has no backfill on purpose. Admins who changed their password at least once must therefore sign in again after the deploy; the others keep their sessions. Migration `20260927160759_account_roles` gives every existing account, deactivated ones included, the `ADMIN` role, so nobody loses account management; demote the ones that should be `USER` from the accounts page.

Caddy serves the static frontend and reverse proxies `/api`, `/socket.io`, and `/uploads` to the API. The entrypoint runs `prisma migrate deploy`, executes the seed, and starts Fastify (non-root user). `@quiz/shared` is a source package: it exports TypeScript and emits no build artifacts. The image build compiles it alongside the API into an ESM bundle (esbuild, `apps/api/scripts/build.mjs`); installed dependencies remain external, as argon2, sharp, and `@prisma/client` include native binaries or engine binaries. As a result, the production image contains only compiled JavaScript (`node dist/server.js`) and `prisma/` for migrations — neither source code nor compilers are present at runtime. `tsc --noEmit` acts as a type safety gate prior to bundling, and `.dockerignore` keeps host artifacts out of the build context.

A dedicated stage installs only production dependencies (`--prod`), excluding vitest, tsx, esbuild, and pino-pretty from the final image. `@prisma/client` and the `prisma` CLI are runtime requirements — the entrypoint applies migrations on startup — and are therefore listed under `dependencies`. Builds are reproducible: the lockfile and all workspace manifests are copied, and installation is frozen (`--frozen-lockfile`). The SQLite database resides in a named Docker volume (`file:/data/db/quiz.db`) — never on an NFS or network mount.

`PUBLIC_URL` must be the exact origin browsers use: the API refuses unsafe REST requests and socket.io handshakes whose `Origin` differs (CSRF protection). In development, testing from a phone on the LAN therefore means setting `PUBLIC_URL` in `apps/api/.env` to that LAN address. Caddy adds security headers and a strict Content-Security-Policy on every route and caps request bodies; the `/api` cap follows `UPLOAD_MAX_AUDIO_MB` (`packages/shared/src/constants.ts`), so raise both together. Base images are pinned by tag and sha256 digest (the bump procedure is commented in each Dockerfile) and the API image needs BuildKit. A failing seed stops the API container instead of starting it without a usable admin.

## Quality

- Strict TypeScript (`noUncheckedIndexedAccess`), ESLint 9, Prettier.
- Business rules = pure functions with 100% test coverage in `packages/shared`.
- Anti-cheat: participant payloads never leak correct answers (automated leak prevention tests + verified via integration tests), and a participant's score and rank leave out the open question until it closes.
- Idempotent commands (`expectedIndex`): presenter double-clicks are ignored.
- Resume where you left off: socket reconnection with token, full state snapshot resynchronized.

## License

Source-available, **not** open source.

The code is published under the [PolyForm Noncommercial License 1.0.0](LICENSE): you are free to use, study, modify and redistribute it **for noncommercial purposes only** — personal use, learning and research, hobby projects, non-profits, schools and universities, public research bodies, public safety, health and environmental organisations, and government institutions.

Every copy, fork and derivative work must keep the attribution line carried by [NOTICE](NOTICE) — the `Required Notice:` mechanism of the license. It is a condition of the license, not a courtesy.

Any commercial exploitation — running it as a paid or revenue-generating hosted service (SaaS), reselling it, shipping it inside a paid product, or delivering paid services with it — requires a separate commercial license. Yajusta is the sole copyright holder and the only party able to grant one: <https://www.yajusta.fr/#contact>.

Contributions are accepted under permissive inbound terms, so that this dual-licensing model keeps working — see [CONTRIBUTING.md](CONTRIBUTING.md).
