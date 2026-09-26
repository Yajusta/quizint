# Test de charge — protocole et résultats

## Protocole

```bash
# 1. API démarrée (DATABASE_URL + JWT_SECRET), un quiz de >= 2 questions en base
#    (aucun service de base à lancer : SQLite est un fichier)
# 2. Lancer le smoke de charge :
cd apps/api
node --max-old-space-size=2048 test/load-smoke.mjs 200
```

Le script (`test/load-smoke.mjs`) :

1. Connecte un présentateur (JWT via cookies) et N clients `/participant` en websocket.
2. Mesure la latence de `participant:join` pour les N clients (p50/p95/p99).
3. Ouvre la session, laisse tous les bots répondre à la question 0.
4. Clôt la question et mesure la réception des événements `question:open` / `answer:submit` acks.

> **Défaut connu du script** : la ligne `close→broadcast: 0/N` est un faux négatif. Les
> listeners `question:closed` sont enregistrés _à l'intérieur_ du callback de
> `question:close`, donc après que le serveur a déjà diffusé l'événement. La métrique vaut
> 0 par construction et ne mesure rien. À corriger si l'on veut réellement l'observer.

### Limites par IP et contrôles d'origine

Le script ouvre tous ses sockets depuis une seule adresse (le loopback). Le plafond de sockets
`/participant` simultanés par IP, `MAX_PARTICIPANT_SOCKETS_PER_IP` (600, soit
`MAX_PARTICIPANTS_PER_SESSION` + 100), reste au-dessus des 500 clients du profil le plus
agressif. Les autres limites par IP de `plugins/live.ts` s'appliquent aussi à ce trafic :
120 handshakes et 60 `participant:join` par fenêtre de 10 s ; au-delà, le serveur répond
`RATE_LIMITED`.

Le script (Node, `socket.io-client`) n'envoie pas d'en-tête `Origin` : ni le garde CSRF des
requêtes REST ni le contrôle d'origine des handshakes socket.io ne le bloquent. Aucun
réglage de `PUBLIC_URL` n'est donc nécessaire pour la mesure.

## Résultats — SQLite (win32-x64, Node 25, machine de dev)

| Métrique                     | 200 clients              | 500 clients               |
| ---------------------------- | ------------------------ | ------------------------- |
| Joins concurrents            | 200/200 OK, 0 erreur     | 500/500 OK, 0 erreur      |
| Temps total des joins        | 2 439 ms                 | 10 729 ms                 |
| Latence join p50 / p95 / p99 | 1 284 / 2 272 / 2 367 ms | 4 179 / 9 735 / 10 408 ms |
| `question:open` reçus        | 200/200                  | 500/500                   |
| `answer:submit` acks         | 200/200                  | 500/500                   |
| RSS processus client de test | 89 Mo                    | 210 Mo                    |

Contrôles de base après la rafale de 500 réponses :

| Contrôle                                               | Résultat               |
| ------------------------------------------------------ | ---------------------- |
| `SQLITE_BUSY` / `database is locked` dans les logs API | 0                      |
| Erreurs applicatives (`level>=40`, HTTP 5xx)           | 0                      |
| Réponses persistées pour la session                    | 500 / 500              |
| `pnpm --filter @quiz/api check:scores`                 | aucune dérive de score |

Chaque réponse est écrite dans une transaction **avant** son acquittement ; l'absence de
contention confirme que `?connection_limit=1` (sérialisation au niveau du pool Prisma)
suffit à écarter `SQLITE_BUSY` sur le pic d'écriture d'une session live.

### Reprise après redémarrage

Session ouverte, un participant ayant répondu, API tuée brutalement puis redémarrée :
la reconnexion du présentateur déclenche `getOrLoad()`, qui reconstruit l'état chaud
depuis la base. Phase `QUESTION_OPEN` préservée, participant restauré avec son score.

## Référence historique — PostgreSQL

Mesure antérieure à la migration, sur une **autre machine** (32 Go RAM, linux-x64,
Node 22) : 200 joins en 1 485 ms, p50/p95/p99 = 490 / 1 162 / 1 224 ms, 200/200 sur
`question:open` et les acks.

⚠️ Ces chiffres ne sont **pas comparables** à ceux ci-dessus : matériel, OS et version de
Node diffèrent. Pour un delta PostgreSQL vs SQLite exploitable, il faudrait rejouer les
deux sur la même machine.

## Reprendre la mesure

Le script est idempotent : chaque exécution crée une session fraîche. Pour un
profil plus agressif : `node test/load-smoke.mjs 500`.
