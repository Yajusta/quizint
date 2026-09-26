# Contribuer

[English version](CONTRIBUTING.md)

Les rapports de bugs, les idées et les pull requests sont les bienvenus.

## Licence des contributions — à lire en premier

Ce projet est sous double licence : la [PolyForm Noncommercial License 1.0.0](LICENSE) pour tout le monde, plus des licences commerciales que Yajusta seul peut accorder (voir [NOTICE](NOTICE)). Ce modèle ne tient que si Yajusta peut concéder des licences sur l'intégralité du code — votre contribution comprise.

Ainsi, en ouvrant une pull request, en envoyant un patch ou en soumettant de quelque manière que ce soit du contenu à ce dépôt, vous accordez à Yajusta une licence perpétuelle, mondiale, non exclusive, gratuite et irrévocable — avec droit de sous-licencier en cascade — d'utiliser, reproduire, modifier, adapter, publier, distribuer et exploiter commercialement votre contribution, en tout ou partie, sous n'importe quelles conditions de licence, y compris propriétaires et commerciales.

Vous conservez votre droit d'auteur : il s'agit d'une concession de licence, pas d'une cession. Vous restez libre d'utiliser votre propre contribution ailleurs, aux conditions de votre choix.

Vous certifiez également avoir écrit vous-même cette contribution, ou disposer du droit de la soumettre à ces conditions — le [Developer Certificate of Origin 1.1](https://developercertificate.org/). Attestez-le en signant chaque commit :

```bash
git commit -s -m "fix: ..."
```

Une pull request sans signature ne peut pas être fusionnée. Si vous contribuez dans le cadre de votre emploi, assurez-vous d'avoir l'accord de votre employeur au préalable.

## Travailler sur le code

Lisez [CLAUDE.md](CLAUDE.md) avant toute chose : l'architecture, les invariants à préserver et les conventions y sont décrits. En résumé :

- `packages/shared` est le contrat unique (schémas Zod + règles métier pures). Une évolution de règle métier s'y écrit, avec un test ; l'API et le web ne font que la câbler.
- `docs/PROTOCOL.md` est généré depuis les schémas Zod — ne l'éditez jamais à la main, lancez `pnpm docs:protocol`.
- Les textes affichés vivent dans `apps/web/src/i18n/locales/<lng>/`, jamais en dur. Chaque clé française a sa contrepartie anglaise.
- Le design system vendoré sous `apps/web/src/design-system/` ne doit pas être reformaté ; consignez chaque écart délibéré dans son propre `README.md`.
- Règles de sécurité : construisez les chemins d'API du web avec le gabarit étiqueté `apiPath` (`apps/web/src/lib/api-client.ts`), jamais par concaténation ; ne vérifiez un jeton d'accès que via `app.verifyAccessToken` ; faites passer chaque payload participant par `toParticipantQuestionView()` ; placez toute nouvelle limite dans `packages/shared/src/constants.ts`. Si vous relevez `UPLOAD_MAX_AUDIO_MB`, relevez aussi le plafond `request_body` de `/api` dans `deploy/Caddyfile`.

## Avant d'ouvrir une pull request

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Les quatre doivent passer — la CI enchaîne la même séquence. Gardez un historique lisible : un changement logique par commit, des sujets au format [Conventional Commits](https://www.conventionalcommits.org/).

## Signaler une faille de sécurité

N'ouvrez pas d'issue publique. Contactez-nous en privé : <https://www.yajusta.fr/#contact>.
