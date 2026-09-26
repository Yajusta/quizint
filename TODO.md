# TODO

## Bugs

- [ ]

## Features

- [ ]

## Tech

Compromis assumés de la remédiation de sécurité, à reprendre si le contexte change :

- [ ] La déconnexion ne coupe pas les sockets présentateur déjà ouverts (impossible de cibler un seul appareil) : ils restent actifs jusqu'à leur coupure, et leur handshake suivant est refusé.
- [ ] La liste des jetons d'accès révoqués par une déconnexion vit en mémoire : un redémarrage l'oublie. Sans conséquence tant qu'il n'y a qu'un processus API (cookies déjà effacés, JWT expiré sous 15 min) ; à persister si ce n'est plus le cas.
- [ ] Une réponse de rotation du refresh token perdue en route, puis rejouée dans la fenêtre de grâce, n'obtient qu'un jeton d'accès : le navigateur concerné doit se reconnecter à son expiration.
