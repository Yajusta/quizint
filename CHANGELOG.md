# Changelog

## Unreleased

Account roles. One new migration (`20260927160759_account_roles`): every existing account, deactivated ones included, becomes `ADMIN`; demote the ones that should be `USER` after deploy.

- Auth: accounts are `ADMIN` or `USER`. A `USER` manages only their own quizzes, sessions and password; an `ADMIN` also manages accounts. New accounts are `USER` by default, and the seed creates an `ADMIN`.
- Auth: `/admins` routes answer 403 to a `USER`. The role is read on every request, so a promotion or a demotion applies at once.
- Auth: an admin can promote or demote another account. At least one active `ADMIN` always remains (`LAST_ADMIN`).
- Auth: an `ADMIN` can reset another account's password (`POST /admins/:id/password`). This signs the account out everywhere and lifts its login delay. It is rate-limited per admin. An account still changes its own password through change-password.
- Web: the accounts page reads "Accounts" for an `ADMIN` (roles, promote/demote, reset password, role on creation) and "My account" for a `USER` (own password only).

## 0.1.1 (2026-09-27)

Security audit remediation. Two new migrations (`20260926110000_admin_password_changed_at`, `20260926120000_quiz_played_question_ids`), applied by `prisma migrate deploy` at container start.

- Auth: an admin can no longer reset a colleague's password (`PATCH /admins/:id` rejects a `password` field). Access JWTs are HS256 with a pinned issuer and audience and carry the credential version: a password change invalidates every earlier access token at once, and logout revokes the current one. A refresh replayed inside the rotation grace gets an access token only. Passwords are capped at 256 characters.
- API: CSRF guard on unsafe REST methods (`Sec-Fetch-Site` / `Origin` against `PUBLIC_URL`); 5xx errors answer a generic `INTERNAL` without their message; `X-Forwarded-For` is trusted for one hop, from a private peer only.
- Live: socket.io handshakes from a browser origin other than `PUBLIC_URL` are refused; handshake payloads are validated; at most 600 participant sockets per IP; every presenter command is rate-limited; a participant's score and rank no longer include the open question before it closes; an answer queued behind a reopen is refused.
- Quizzes: the played lock survives session deletion and is re-checked inside the save transaction.
- Uploads: stricter multipart limits and a 40-megapixel decode cap. CSV exports: hardened formula-injection escaping.
- Web: API paths are built with an encoding helper (`apiPath`); editor drafts are cleared on logout.
- Deploy: Caddy security headers and CSP on every route, request body caps, base images pinned by digest, pnpm pinned by hash; a seed failure stops the API container. The protocol mock server listens on `127.0.0.1` unless `MOCK_HOST` says otherwise.

Security audit remediation, run 2. One new migration (`20260926130000_refresh_token_credential_version`): admins who have ever changed their password sign in again once after deploy.

- Auth: a refresh token no longer survives a password change or a deactivation.
- Auth: failed logins slow down progressively per account instead of locking it.
- Auth: IPv6 clients are rate-limited per /64.
- Auth: change-password is rate-limited per admin and per address.
- Auth: concurrent password hashing is capped.
- Auth: the API refuses to start without a strong `JWT_SECRET` unless `NODE_ENV` is `development` or `test`.
- Live: the default socket.io namespace is refused.
- Live: participants are disconnected when a session ends.
- Live: a failed auto-close is retried.
- Live: sockets that connect while a session ends or an admin is revoked are handled.
- Live: a participant tab replaced by another device can take its seat back.
- Sessions: session creation and quiz archiving are atomic, and the anonymous join lookup no longer loads the quiz snapshot.
- Quizzes: a duplicate drops media the caller does not own.
- Web: editor drafts are only restored for the admin who wrote them.
- Web: exports open with `noopener`.
- Web: the login page shows when to retry.

## 0.1.0 (2026-09-20)

- Initial release.
