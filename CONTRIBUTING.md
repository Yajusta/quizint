# Contributing

[Version française](CONTRIBUTING.fr.md)

Bug reports, ideas and pull requests are welcome.

## Licensing of contributions — read this first

This project is dual-licensed: the [PolyForm Noncommercial License 1.0.0](LICENSE) for everyone, plus commercial licenses that Yajusta alone may grant (see [NOTICE](NOTICE)). That model only works if Yajusta can license the whole codebase — your contribution included.

So, by opening a pull request, sending a patch, or otherwise submitting material to this repository, you grant Yajusta a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license — with the right to sublicense through multiple tiers — to use, reproduce, modify, adapt, publish, distribute and commercially exploit your contribution, in whole or in part, under any license terms, including proprietary and commercial ones.

You keep your copyright: this is a license grant, not an assignment. You stay free to use your own contribution anywhere else, under any terms you like.

You also certify that you wrote the contribution yourself, or otherwise have the right to submit it under these terms — the [Developer Certificate of Origin 1.1](https://developercertificate.org/). Record it by signing off every commit:

```bash
git commit -s -m "fix: ..."
```

Pull requests without a sign-off cannot be merged. If you are contributing on behalf of an employer, make sure you have their permission first.

## Working on the code

Read [CLAUDE.md](CLAUDE.md) before anything else: it states the architecture, the invariants to preserve and the conventions. The short version:

- `packages/shared` is the single contract (Zod schemas + pure business rules). Business-rule changes belong there, with a test; the API and the web app only wire them.
- `docs/PROTOCOL.md` is generated from the Zod schemas — never hand-edit it, run `pnpm docs:protocol`.
- User-facing strings live in `apps/web/src/i18n/locales/<lng>/`, never inline. Every French key needs its English counterpart.
- The vendored design system under `apps/web/src/design-system/` must not be reformatted; log every deliberate deviation in its own `README.md`.

## Before opening a pull request

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All four must pass — CI runs the same sequence. Keep the commit history readable: one logical change per commit, [Conventional Commits](https://www.conventionalcommits.org/) subject lines.

## Reporting a security issue

Do not open a public issue. Get in touch privately: <https://www.yajusta.fr/#contact>.
