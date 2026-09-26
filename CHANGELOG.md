# Changelog

## Unreleased

Security audit remediation. Two new migrations (`20260926110000_admin_password_changed_at`, `20260926120000_quiz_played_question_ids`), applied by `prisma migrate deploy` at container start.

- Auth: an admin can no longer reset a colleague's password (`PATCH /admins/:id` rejects a `password` field). Access JWTs are HS256 with a pinned issuer and audience and carry the credential version: a password change invalidates every earlier access token at once, and logout revokes the current one. A refresh replayed inside the rotation grace gets an access token only. Passwords are capped at 256 characters.
- API: CSRF guard on unsafe REST methods (`Sec-Fetch-Site` / `Origin` against `PUBLIC_URL`); 5xx errors answer a generic `INTERNAL` without their message; `X-Forwarded-For` is trusted for one hop, from a private peer only.
- Live: socket.io handshakes from a browser origin other than `PUBLIC_URL` are refused; handshake payloads are validated; at most 600 participant sockets per IP; every presenter command is rate-limited; a participant's score and rank no longer include the open question before it closes; an answer queued behind a reopen is refused.
- Quizzes: the played lock survives session deletion and is re-checked inside the save transaction.
- Uploads: stricter multipart limits and a 40-megapixel decode cap. CSV exports: hardened formula-injection escaping.
- Web: API paths are built with an encoding helper (`apiPath`); editor drafts are cleared on logout.
- Deploy: Caddy security headers and CSP on every route, request body caps, base images pinned by digest, pnpm pinned by hash; a seed failure stops the API container. The protocol mock server listens on `127.0.0.1` unless `MOCK_HOST` says otherwise.

## 0.1.0 (2026-09-20)

- Initial release.
