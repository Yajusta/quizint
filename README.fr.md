# Quizint

[English version](README.md)

Application complète de quiz live : back-office d'édition, écran présentateur projeté, participants sur mobile. Monorepo pnpm, TypeScript strict de bout en bout.

## Démarrage (4 commandes)

```bash
pnpm install                                            # dépendances
cp apps/api/.env.example apps/api/.env                  # config
pnpm --filter @quiz/api db:migrate                      # migration + seed premier admin
pnpm dev                                                # api :3000 + web :5173
```

Compte initial : `admin@example.fr` / `admin-password-12` (issu du seed — à changer).

> Aucun service de base de données à lancer : la base est un fichier SQLite (`apps/api/data/quiz.db`) créé automatiquement par la migration, qui crée les tables ; le seed crée le premier admin (§5.1).

## Parcours

| Rôle         | Route                 | Description                                                                     |
| ------------ | --------------------- | ------------------------------------------------------------------------------- |
| Participant  | `/`                   | Saisie du code à 6 caractères                                                   |
| Participant  | `/j/:code`            | Pseudo → questions → résultats individualisés → podium                          |
| Admin        | `/admin/login`        | Connexion (JWT cookies httpOnly)                                                |
| Admin        | `/admin`              | Dashboard : quiz, sessions en cours, import JSON                                |
| Admin        | `/admin/quizzes/:id`  | Éditeur : 4 types de questions, médias, aperçu participant                      |
| Admin        | `/admin/sessions`     | Historique, stats, exports CSV                                                  |
| Présentateur | `/present/:sessionId` | Vue projetée : QR + code, timer, jauges, barres, podium (raccourcis Espace/F/P) |

## Commandes

```bash
pnpm -r typecheck        # TypeScript strict partout
pnpm -r test             # vitest (règles métier partagées + intégration API)
pnpm --filter @quiz/web build    # build production (code-split par route)
pnpm --filter @quiz/api dev      # API en watch
pnpm --filter @quiz/api test     # tests d'intégration API (base SQLite jetable, recréée à chaque run)
pnpm --filter @quiz/api check:scores  # cohérence scores vs SUM(réponses)
node apps/api/test/load-smoke.mjs 200  # smoke de charge (cf. docs/LOAD.md)
pnpm --filter @quiz/shared mock:live    # serveur mock du protocole (dev front)
pnpm --filter @quiz/shared docs:protocol # régénère docs/PROTOCOL.md
pnpm --filter @quiz/web test:e2e        # captures Playwright -> docs/screens/<surface>/
```

Les captures se prennent sur des serveurs lancés à la main : `pnpm mock:live` + `MOCK=1 pnpm --filter @quiz/web dev` pour le participant, le stage et `prefers-reduced-motion` ; l'API et le web normaux (compte du seed) pour le back-office et l'éditeur.

## Vérification du code avec trunk

[Trunk](https://docs.trunk.io/cli) lance d'un coup tous les linters et formateurs du dépôt (ESLint, Prettier, shellcheck, shfmt, hadolint, yamllint, markdownlint, taplo, checkov, grype, osv-scanner, trufflehog, oxipng). Les versions sont épinglées dans `.trunk/trunk.yaml` et le binaire se télécharge tout seul au premier appel : rien à installer.

```bash
pnpm run trunk -- upgrade                # met à jour trunk, ses plugins et les versions de linters
pnpm run trunk -- fmt --all              # formate tout le dépôt (écrit les fichiers)
pnpm run trunk -- check --all --no-fix   # analyse tout le dépôt, sans rien modifier
```

Le `--` est indispensable : sans lui, pnpm avale les arguments au lieu de les passer au lanceur. Le script `trunk` du `package.json` appelle `trunk.ps1` (Windows) ; sous macOS ou Linux, utilisez `./trunk upgrade`, `./trunk fmt --all`, etc.

Ordre habituel : `upgrade` de temps en temps, puis `fmt --all`, puis `check --all --no-fix`, qui doit sortir sans diagnostic.

- **`upgrade`** modifie `.trunk/trunk.yaml` (versions des linters, des runtimes, du CLI) : relisez le diff et commitez-le. `--dry-run` liste les mises à jour sans les appliquer ; un scope (`trunk upgrade check`, `plugins`, `runtimes`, `tools`, `cli`) restreint la portée.
- **`fmt --all`** réécrit les fichiers. Vérifiez `git diff` avant de commiter : le design system vendoré (`apps/web/src/design-system/**`) et les fichiers générés (`docs/PROTOCOL.md`, `docs/quiz-import-schema.json`, `pnpm-lock.yaml`) sont exclus par `.prettierignore` et ne doivent pas bouger — s'ils apparaissent dans le diff, c'est une régression à annuler.
- **`check --all --no-fix`** donne un verdict en lecture seule : `--all` couvre tout le dépôt au lieu des seuls fichiers modifiés, `--no-fix` interdit toute réécriture automatique. C'est la forme à utiliser avant un commit ou en CI, où l'on veut un échec plutôt qu'une correction silencieuse.

`trunk` complète `pnpm lint` et `pnpm typecheck` sans les remplacer : le typage reste gardé par `tsc --noEmit`.

## Architecture

```text
packages/shared     Contrat unique : schémas Zod (domaine, REST, événements socket),
                    règles métier pures 100% testées (scoring, machine à états,
                    pseudos, stats).
                    mock-server : rejoue le protocole §6 pour développer le front sans API.
apps/api            Fastify + Prisma (SQLite). Modules : auth (argon2 + JWT cookies
                    + refresh tournant), quizzes (transactionnel, verrouillage),
                    media (magic bytes + sharp WebP), sessions (snapshot figé), live
                    (SessionManager : état chaud, timers réarmables, verrou par session),
                    exports CSV (BOM, décimales FR).
apps/web            React 19 + Vite. Design system vendoré (tokens, composants .jsx ; les
                    écarts sont listés dans src/design-system/README.md), polices
                    auto-hébergées — zéro CDN, CSP-friendly. Deux fonds fixes, sans bascule :
                    app claire, stage sombre. Écrans par surface (pages/participant,
                    pages/presenter, pages/admin, pages/admin/editor) ; e2e/ capture chaque
                    état dans docs/screens/<surface>/.
deploy/             Compose prod, Dockerfiles multi-stage, Caddy (TLS auto, gzip,
                    reverse proxy /api /socket.io /uploads).
docs/               PROTOCOL.md (généré), LOAD.md, schéma d'import JSON.
```

Décisions détaillées : `docs/ARCHITECTURE.md`. Protocole temps réel : `docs/PROTOCOL.md`.

## Production

```bash
cd deploy
cp .env.example .env   # DOMAIN, JWT_SECRET, admin seed
docker compose up -d --build
```

Caddy sert le front statique et proxifie `/api`, `/socket.io`, `/uploads` vers l'API. L'entrypoint applique `prisma migrate deploy`, joue le seed, puis démarre Fastify (non-root). `@quiz/shared` est un paquet source : il exporte du TypeScript et n'émet rien. Le build de l'image le compile avec l'API en un bundle ESM (esbuild, `apps/api/scripts/build.mjs`) ; les dépendances installées restent externes, car argon2, sharp et `@prisma/client` embarquent des binaires natifs ou des moteurs. L'image de production ne contient donc que du JavaScript compilé (`node dist/server.js`) et `prisma/` pour les migrations — ni source ni transpileur au démarrage. `tsc --noEmit` sert de garde-fou de types avant le bundle, et un `.dockerignore` tient les artefacts de l'hôte hors du contexte de build.

Un étage dédié installe les seules dépendances de production (`--prod`), ce qui écarte vitest, tsx, esbuild et pino-pretty de l'image finale. `@prisma/client` et la CLI `prisma` sont des besoins d'exécution — l'entrypoint applique les migrations au démarrage — et figurent donc en `dependencies`. Les builds sont reproductibles : le lockfile et tous les manifestes du workspace sont copiés, et l'installation est gelée (`--frozen-lockfile`). La base SQLite vit dans un volume Docker nommé (`file:/data/db/quiz.db`) — jamais sur un montage NFS ou réseau.

## Qualité

- TypeScript strict (`noUncheckedIndexedAccess`), ESLint 9, Prettier.
- Règles métier = fonctions pures couvertes à 100 % par les tests de `packages/shared`.
- Anti-triche : les payloads participants n'exposent jamais les bonnes réponses (test automatique de non-fuite + vérifié dans les tests d'intégration).
- Commandes idempotentes (`expectedIndex`) : double-clic présentateur ignoré.
- Reprenez où vous étiez : reconnexion socket avec token, snapshot complet resynchronisé.

## Licence

Code source ouvert à la lecture, mais **pas open source**.

Le code est publié sous [PolyForm Noncommercial License 1.0.0](LICENSE) : vous êtes libre de l'utiliser, de l'étudier, de le modifier et de le redistribuer **à des fins non commerciales uniquement** — usage personnel, apprentissage et recherche, projets de loisir, associations, écoles et universités, organismes de recherche publique, de sécurité publique, de santé ou de protection de l'environnement, et institutions publiques.

Toute copie, fork ou œuvre dérivée doit conserver la ligne d'attribution portée par [NOTICE](NOTICE) — le mécanisme `Required Notice:` de la licence. C'est une condition de la licence, pas une politesse.

Toute exploitation commerciale — service hébergé payant ou générateur de revenus (SaaS), revente, intégration dans un produit payant, prestations payantes bâties dessus — requiert une licence commerciale distincte. Yajusta est l'unique titulaire des droits et le seul à pouvoir l'accorder : <https://www.yajusta.fr/#contact>.

Les contributions sont acceptées sous des conditions permissives, afin que ce modèle de double licence reste praticable — voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md).
