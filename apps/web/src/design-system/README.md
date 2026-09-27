# Design system — kit vendoré `quiz-design`

Source : `.claude/skills/quiz-design` (tokens + composants). Ce dossier en est une **copie
vendorée**. Hors les écarts listés ci-dessous, les fichiers `.jsx`, `.d.ts` et `.prompt.md` sont
identiques au skill et ne doivent pas être réécrits ; `.prettierignore` les exclut du formatage
pour garder le diff avec le skill lisible.

Provenance et licence : le kit `quiz-design` est une création originale de Yajusta, pas un kit
tiers. Ce dossier relève donc de la licence du dépôt ([LICENSE](../../../../LICENSE)) et
n'emporte aucune obligation externe ; voir [NOTICE](../../../../NOTICE).

Quatre fichiers seulement sont **locaux** et n'existent pas dans le skill : `core/Wordmark.tsx`,
`quiz/StageFrame.tsx`, `quiz/Podium.tsx`, `motion/CountUp.tsx` (specs normatives au plan § 13), plus
`core/Icon.tsx` qui remplace l'`Icon.jsx` du skill.

Non vendorés : `navigation/SideNav`, `navigation/Stepper` (plan § 7-4 : barre haute + `Tabs`),
ainsi que les fichiers de démonstration `*.card.html` du skill.

Supprimés de l'ancien kit maison : `brand/Logo.jsx`, `core/ThemeToggle.tsx`, `feedback/Toast`,
`feedback/Tooltip`, `tokens/surfaces.css`, `tokens/radii.css`, `assets/fonts/*`, et
`src/features/theme/useTheme.ts`.

---

## Patchs appliqués au kit (plan § 4.2)

### `core/Icon.tsx` — remplace `Icon.jsx`

Le skill charge Lucide depuis `unpkg` en masque CSS : **aucun CDN n'est autorisé** dans ce produit.
Le composant local rend `lucide-react` en imports nommés (tree-shaking).

- Tailles `sm`/`md`/`lg`/`xl` → **14 / 18 / 22 / 28**, ou un nombre de pixels ; défaut `md`.
- `strokeWidth` 1,75 par défaut, `color` = `currentColor`, `aria-hidden` sauf si `title`.
- Nom inconnu ⇒ carré pointillé de la bonne taille (jamais de glyphe invisible).
- Registre étendu au-delà du working set du skill : `library`, `history`, `bar-chart-3`, `pencil`,
  `search`, `download`, `rotate-ccw`, `list-plus`, `archive`, `circle-help`, `chevron-right`,
  `arrow-left`, `square`, `user`, `minus`, `wifi-off`, `log-out`, `inbox`, `lock`,
  `grip-vertical`, `trophy`, `user-x`, `upload`, `copy`, `maximize`, `maximize-2`, `minimize`,
  `monitor-smartphone`.
- lucide-react 1.x a renommé certains exports : les slugs du skill sont conservés et pointent sur
  les noms canoniques (`bar-chart-3` → `ChartColumn`, `circle-help` → `CircleQuestionMark`,
  `history` → `RotateCcwClock`, `trash-2` → `Trash`).

### `tokens/fonts.css`

`@import` Google Fonts remplacé par `@fontsource` (bundlé par Vite, auto-hébergé, CSP-safe) :
Space Grotesk 500/600/700, Instrument Sans 400/500/600, JetBrains Mono 500/700 — sous-ensembles
`latin` et `latin-ext` uniquement. `@fontsource/open-sans` et les `.woff2` locaux sont supprimés.

### `tokens/colors.css` — alias stage

Le skill écrit `rgba(255,255,255,.06)` et consorts **en dur dans chaque composant**. Ces valeurs
sont promues en alias ; **les valeurs sont celles du skill, seuls les noms sont nouveaux**.

| Token                   | Valeur                  | Origine    | Usage                                             |
| ----------------------- | ----------------------- | ---------- | ------------------------------------------------- |
| `--stage-panel`         | `rgba(255,255,255,.06)` | plan § 3.1 | cartes, tuiles, lignes de classement              |
| `--stage-border`        | `rgba(255,255,255,.12)` | plan § 3.1 | bordures des panneaux                             |
| `--stage-border-strong` | `rgba(255,255,255,.28)` | plan § 3.1 | bordure du bloc rang 1, boutons inverse           |
| `--stage-ink-2`         | `rgba(239,234,246,.7)`  | plan § 3.1 | texte secondaire sur stage                        |
| `--stage-panel-2`       | `rgba(255,255,255,.10)` | local      | fond `PlayerChip tone=dark`                       |
| `--stage-control`       | `rgba(255,255,255,.14)` | local      | fond `Button`/`IconButton` `variant=inverse`      |
| `--stage-control-hover` | `rgba(255,255,255,.22)` | local      | survol des mêmes                                  |
| `--stage-border-2`      | `rgba(255,255,255,.18)` | local      | bordure `PlayerChip`, piste `ProgressBar inverse` |
| `--stage-brand-soft`    | `rgba(179,159,208,.16)` | local      | fond de la ligne `highlight` sur stage            |
| `--stage-brand-border`  | `rgba(179,159,208,.4)`  | local      | bordure de la même                                |

Deux consolidations : `rgba(239,234,246,.66)` (`JoinCode`) et `rgba(239,234,246,.6)`
(`LeaderboardRow`) passent sur `--stage-ink-2` (.7) ; le survol `.24` de `IconButton inverse`
passe sur `--stage-control-hover` (.22).

Ajout `--red-700 #A83126` : le skill écrivait cette valeur en dur comme survol du `Button danger`.

### `tokens/elevation.css`

Le token « overlay-scrim » du skill est renommé **`--scrim`** (valeur inchangée) : ce préfixe
appartenait à l'espace de noms des overlays de l'ancien kit maison, dont la disparition complète
est vérifiée par grep.

### `tokens/motion.css`

Ajout d'un bloc `@media (prefers-reduced-motion: reduce)` qui met les durées à zéro et neutralise
animations et transitions (plan § 3.4 : « prefers-reduced-motion coupe tout »).

### `tokens/base.css`

Ajout des niveaux de titre par défaut `h1`/`h2`/`h3`/`h4` (le skill ne posait que `margin: 0`).

### `tokens/radius.css`

Renommé depuis `radii.css` ; contenu identique au skill (4/6/10/14/20/28/999).

### `styles.css`

Liste d'`@import` du skill + les keyframes globales `qiSpin`, `qiFade`, `qiRise`, `qiPulse`.
`qiRise` perd le `scale(.99)` de l'ancien kit : rien ne doit changer d'échelle (§ 3).

### `core/Button.jsx`

- **Prop `loading`** : le glyphe de tête devient un spinner (`qiSpin`), `aria-busy="true"`,
  `onClick` neutralisé, curseur `progress`. Le bouton reste focusable.
- **Taille `xl`** : 64 px (`--control-h-xl`), padding `--space-8`, libellé 19 px, icône 22 px —
  cible du pouce côté participant et action unique du pied de stage.
- Survol `danger` : `#A83126` → `var(--red-700)`.
- `variant="inverse"` : alpha en dur → `--stage-control` / `--stage-control-hover` /
  `--stage-border-strong`.

### `core/IconButton.jsx`

`variant="inverse"` : mêmes alias stage que `Button`.

### `feedback/Dialog.jsx`

Le skill rend la modale en `position: absolute` (le parent doit être `relative`). Patch :
`createPortal` sur `<body>`, `position: fixed`, **piège à focus** (Tab / Shift+Tab bouclent),
focus initial sur le premier élément focusable, **Échap ferme**, focus rendu à l'élément d'origine
au démontage.

### `feedback/Timer.jsx`

`tone` par défaut passe de `auto` à **`brand`** (écart assumé § 7-3 : un anneau vert se lit comme
« bonne réponse » alors que la couleur ne doit signifier que sélection ou correction).
`brand` = `--brand-700` (app claire), `inverse` = `--brand-300` (stage) ; **sous 5 s**, les deux
basculent sur `--state-danger`. Piste de l'anneau : `--gray-200` clair, `--stage-border` stage.
Ajout de `role="timer"` + `aria-label`, le chiffre passe `aria-hidden`.

### `quiz/AnswerOption.jsx`

- Prop **`disabled`** explicite : le skill forçait `disabled` dès que `state="muted"`, ce qui
  empêchait d'afficher une distribution cliquable après la révélation.
- **Tuile-lettre ronde** (`--radius-full` au lieu de `--radius-md`) — écart assumé § 7-8.
- Prop **`check`** : remplace la lettre par une coche dans la tuile une fois la réponse enregistrée.
- Repli hexadécimal en dur supprimé (`var(--answer-rest-bg, #FFFFFF)` → `var(--answer-rest-bg)`) :
  il n'y a qu'un seul jeu de tokens ici, et l'anti-pattern § 12 interdit les couleurs en dur.

### `quiz/StatTile`, `LeaderboardRow`, `PlayerChip`, `QuestionDisplay`, `JoinCode`

rgba en dur → alias `--stage-*` (table ci-dessus). Dans `StatTile`, la déclaration
`textTransform: 'uppercase'` a été replacée sur la même ligne que `font: var(--text-overline)`
(reformatage seul) pour que le grep § 12 reste lisible.

### `...rest` sur la racine

Le skill n'expose pas `...rest` sur la plupart des composants, ce qui empêche de passer `id`,
`onClick`, `aria-*` ou `data-*`. Ajouté sur : `Field`, `Checkbox`, `Radio`, `Switch`,
`ProgressBar`, `Timer`, `EmptyState`, `Dialog`, `Tabs`, `QuestionDisplay`, `JoinCode`,
`PlayerChip`, `LeaderboardRow`, `StatTile`. (`Card`, `AnswerOption`, `Button`, `IconButton`,
`Badge`, `Tag`, `Input`, `Textarea`, `Select` l'avaient déjà.)

### `.d.ts` — React 19

`@types/react` 19 ne déclare plus le `JSX` global. Chaque contrat commence désormais par
`import type * as React from 'react';` et rend `React.JSX.Element`. Les interfaces qui reçoivent
`...rest` étendent les `HTMLAttributes` correspondants ; `Dialog` (`title`), `AnswerOption`
(`onClick`), `Checkbox`/`Radio`/`Switch` (`onChange`) passent par `Omit<…>` pour éviter un conflit
de signature avec les handlers du DOM.

---

## Composants locaux (plan § 13, specs normatives)

| Fichier               | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/Wordmark.tsx`   | « Quizint », Space Grotesk 700 `-0.03em`, `tone=light\|dark`, 19/24/32 px, `href` optionnel. Patch : le mot est précédé du **pictogramme** (`public/quizint.png`, hauteur 1,2 × la police, `alt=""` — le mot porte déjà la marque) ; `mark={false}` revient au wordmark purement typographique. Sur `tone="dark"`, la source est `public/quizint-light.png` : le violet du logo (`#4a2e6b`) ne contraste qu'à 1,4:1 avec `--stage-bg` (`--brand-900`), la variante repeint cette moitié en `--brand-100`. |
| `quiz/StageFrame.tsx` | Cadre du stage : `100dvh`, `1fr auto`, gouttières 64/80 (40 sous 1100 px), pied 88 px à slots `progress` / `status` / `actions`. Raccourcis `<kbd>` : simple texte, ou bouton quand l'entrée porte `onClick` (même action que la touche, `aria-pressed` pour une bascule, icône seule avec `iconOnly`) ; sous 1100 px seuls les boutons restent, en icône. `StageInsetContext` décale les seuils de largeur de la place prise par un panneau latéral.                                                     |
| `motion/CountUp.tsx`  | Compteur mono 600 ms `easeOutCubic` (aucun dépassement), format `fr-FR`, reprise depuis la valeur affichée, direct sous `prefers-reduced-motion`.                                                                                                                                                                                                                                                                                                                                                         |
| `quiz/Podium.tsx`     | Podium 2-1-3 du classement final (§ 13.3) : blocs 240/200/200 × 200/140/110, révélation 3 → 2 → 1 à 0/600/1 200 ms, ressort sur le déplacement seul, `CountUp` au posé, `onRevealed` à 2 400 ms, direct sous `prefers-reduced-motion`, `role=list` + ordinal FR.                                                                                                                                                                                                                                          |

---

## Patchs du lot 1 (participant)

| Fichier               | Patch                                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forms/Input.jsx`     | Taille **`xl`** (64 px, `--control-h-xl`, police `--text-body-lg`) — saisie du code de session et réponse numérique. `{...rest}` est spread **avant** les handlers de focus (un `onFocus`/`onBlur` de l'appelant écrasait le suivi du focus). Encre `--text-muted` à l'état `disabled` (règle du skill). |
| `core/IconButton.jsx` | Taille **`xl`** (64 px, icône `lg`) — créée pour la bascule du signe de la réponse numérique, retirée depuis (le « - » se tape dans le champ) ; la taille reste disponible.                                                                                                                              |
| `tokens/base.css`     | `::placeholder { color: var(--gray-400); opacity: 1 }` — le placeholder navigateur se lisait comme une valeur saisie dans le champ code 32 px.                                                                                                                                                           |
| `styles.css`          | Keyframe **`qiDrop`** (entrée depuis le haut, opacité 0 → 1) — pastille de reconnexion du participant, 200 ms `--ease-out`.                                                                                                                                                                              |

Aucun autre composant du kit n'a été modifié : les écrans participant se composent avec
`AnswerOption`, `Timer`, `ProgressBar`, `Badge`, `StatTile`, `LeaderboardRow`, `PlayerChip`,
`EmptyState`, `Field`, `Input`, `Button`, `IconButton`, `Icon`, `Wordmark` et `CountUp`. Les
gabarits de page (`LightShell`, `StageShell`, `ReconnectBanner`) vivent dans
`src/pages/participant/shells.tsx` : ce sont des mises en page, pas des composants du kit —
`StageFrame` reste le cadre du projecteur (gouttières 80 px, pied 88 px) et n'est pas réutilisé sur
un téléphone.

---

## Patchs du lot 2 (stage)

| Fichier                   | Patch                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quiz/Podium.tsx`         | **Nouveau** (§ 13.3), exporté par `index.ts` avec son type `PodiumEntry`. Avec deux entrées, l'emplacement du rang 3 reste vide (espaceur invisible, aucun bloc) pour garder le 1er au centre.                                                        |
| `quiz/AnswerOption.jsx`   | En `size="lg"` (stage), barre de distribution **240 × 10 px** (lisible du fond de la salle) ; espace insécable avant « % » (`{distribution}{NBSP}%`, même correctif que le lot 3). Les autres tailles ne changent pas.                                |
| `core/Button.jsx`         | Correctif partagé avec le lot 3 : `borderColor: undefined` était sérialisé en `''` par React et annulait le raccourci `border` (liseré `currentColor` sur `primary`/`inverse`, cadre sur `ghost`). Une seule déclaration `border`, `disabled` inclus. |
| `quiz/JoinCode.jsx`       | `tone="brand"` : code en `--brand-700` — le panneau blanc du QR (§ 5.2, écart § 7-7) réunit QR et code dans un seul objet à regarder.                                                                                                                 |
| `quiz/LeaderboardRow.jsx` | `score` accepte un nœud React (un nombre reste formaté `fr-FR`) : le top 5 de l'écran de résultat compte ses scores en `CountUp`.                                                                                                                     |
| `feedback/EmptyState.jsx` | `tone="dark"` : variante stage (pastille `--stage-panel-2` + `--brand-300`, encre `--stage-ink` / `--stage-ink-2`) — écran ENDED.                                                                                                                     |
| `styles.css`              | Keyframe **`qiSlideIn`** (entrée depuis la droite, 24 px, opacité 0 → 1) — panneau participants, 200 ms `--ease-out`.                                                                                                                                 |

`StageFrame` est utilisé tel quel. Hors kit : `lib/useThemeColor.ts` exporte désormais `resolveToken`
(le QR du lobby lit `--brand-900` / `--white` au runtime, aucun hex dans la page). Les écrans du stage
vivent dans `src/pages/presenter/Stage*.tsx` ; `stage-shared.tsx` porte les gabarits (tête de question,
progression du pied, badge stage) qui ne sont pas des composants du kit.

---

## Patchs du lot 3 (back-office)

| Fichier                 | Patch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/Button.jsx`       | **Correction de bordure.** Le kit posait `border: v.border` puis, dans le même objet de style, `borderColor: disabled ? 'var(--border-subtle)' : undefined` : React sérialise `undefined` en chaîne vide, ce qui annulait la couleur du raccourci et faisait retomber la bordure sur `currentColor` — cadre visible sur tous les `ghost`, liseré blanc sur les `primary`. Remplacé par une déclaration unique `border: disabled ? '1px solid var(--border-subtle)' : v.border`.                                                                                   |
| `navigation/Tabs.jsx`   | **Interligne stable** : l'onglet sélectionné passait de `600 15px/1` à `var(--text-body)` (1.55), le libellé sautait d'un pixel à la sélection. Les deux états sont désormais en `/1.55`. **Prop `fill`** : les boutons prennent toute la hauteur du conteneur (`align-items: stretch`, `height: 100%`, plus de `padding-bottom`), contenu centré verticalement et soulignement collé au bord bas — pose les onglets dans une barre haute sans calage manuel. **Compteur à 13 px** (`--text-label`, mono) au lieu de 12 : aucun texte sous 13 px (plan § 11.4-6). |
| `quiz/AnswerOption.jsx` | Espace insécable avant le `%` de la distribution (typographie FR, plan § 2.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `core/Wordmark.tsx`     | Prop **`onClick`** optionnelle, posée sur le `<a>` : permet à l'appelant de confier la navigation au routeur (`preventDefault` + `navigate`) au lieu de recharger toute l'application depuis la barre haute. Sans effet si `href` est absent.                                                                                                                                                                                                                                                                                                                     |

Contrat mis à jour en conséquence : `navigation/Tabs.d.ts` (`fill?: boolean`). `Wordmark` est un
composant local `.tsx`, son contrat est le fichier lui-même.

Le back-office n'ajoute aucun composant au kit : il se compose avec `Button`, `IconButton`, `Icon`,
`Badge`, `Card`, `Tabs`, `Field`, `Input`, `Dialog`, `EmptyState`, `AnswerOption`, `LeaderboardRow`,
`StatTile` et `Wordmark`. Les gabarits communs aux pages admin (`AdminLayout`, `PageHeader`,
`SectionTitle`, `ErrorAlert`, `Num`, `ROW`, `riseStyle`) vivent dans
`src/pages/admin/AdminLayout.tsx` : ce sont des mises en page, pas des composants du kit.

---

## Patchs du lot 4 (éditeur)

| Fichier                | Patch                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `forms/Radio.jsx`      | **Prop `disabled`** : groupe inerte (`aria-disabled`, inputs `disabled`, pastille `--gray-100` + point `--gray-400`, libellé `--text-muted`, curseur `not-allowed`) — la coche « bonne réponse » d'une question verrouillée. **Option `{ ariaLabel }`** : une option sans libellé visible garde un nom accessible (`aria-label` sur l'input) et ne rend plus de `<span>` vide — la coche seule devant chaque proposition, le libellé étant l'`Input` voisin. |
| `navigation/Tabs.jsx`  | **Prop `disabled`** : groupe inerte (`aria-disabled`, boutons `disabled`, encre `--text-muted`, curseur `not-allowed`), l'onglet actif reste souligné en `--gray-300` pour dire l'état courant — sélecteur de type d'une question verrouillée. Les onglets passent en `type="button"` : posés dans un formulaire, ils le soumettaient.                                                                                                                       |
| `core/IconButton.d.ts` | Contrat seul : `ref?: React.Ref<HTMLButtonElement>`. React 19 transmet `ref` par les props et le composant spread `...rest` sur le `<button>` ; la poignée de glisser (`setActivatorNodeRef` de `@dnd-kit`) en a besoin. Aucun changement du `.jsx`.                                                                                                                                                                                                         |
| `forms/Textarea.d.ts`  | Contrat seul : `ref?: React.Ref<HTMLTextAreaElement>` — l'énoncé auto-hauteur mesure son `scrollHeight`. Aucun changement du `.jsx`.                                                                                                                                                                                                                                                                                                                         |

Contrats mis à jour en conséquence : `forms/Radio.d.ts` (`disabled`, `ariaLabel`),
`navigation/Tabs.d.ts` (`disabled`).

L'éditeur n'ajoute aucun composant au kit : il se compose avec `Card`, `Badge`, `Tag`, `Button`,
`IconButton`, `Icon`, `Tabs`, `Field`, `Input`, `Textarea`, `Select`, `Radio`, `Switch`,
`AnswerOption`, `Dialog` et `EmptyState`, plus `QuestionCard` (aperçu). Les volets vivent dans
`src/pages/admin/editor/` : `model.ts` (forme cliente, conversions DTO, validation FR, brouillon
24 h), `EditorHeader`, `QuestionList` (`@dnd-kit`), `QuestionForm`, `QuestionSettings`,
`QuestionPreview`, `fields.tsx` (`NumberInput`, `Overline`, `BlockError` — des aides de mise en
page, pas des composants du kit). Deux éléments natifs assumés et commentés : l'`<input type=file>`
masqué du bloc média (le kit n'a pas de champ fichier) et le `<button>` de sélection d'une ligne de
la liste (le kit n'a pas d'élément de liste focusable ; la `Card` reste cliquable à la souris).

---

## Patchs du lot 5 (finitions)

| Fichier                   | Patch                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forms/Switch.jsx`        | **Plus d'`opacity` pour `disabled`** (anti-pattern § 12) : piste `--gray-100`, bordure `--border-subtle`, pastille `--gray-400`, libellé `--text-muted`. La bordure est posée dans les deux états (transparente au repos) et `box-sizing: border-box` garde la géométrie identique ; la pastille passe de 18 à 16 px pour compenser le liseré. |
| `forms/Checkbox.jsx`      | Même correctif : fond `--gray-100`, bordure `--border-subtle`, coche et libellé `--text-muted` au lieu d'un voile d'opacité.                                                                                                                                                                                                                   |
| `quiz/LeaderboardRow.jsx` | Un score négatif passait par `toLocaleString` et sortait avec le trait d'union U+002D. `src/lib/format-fr.ts` (`formatScore`) devient la seule source du formatage FR : vrai signe moins U+2212, collé au nombre (contrairement à un delta — en mono tabulaire, une espace insécable occupe une pleine chasse de chiffre).                     |
| `motion/CountUp.tsx`      | Même défaut, découvert sur la capture du podium : le format par défaut du § 13.4 est `toLocaleString('fr-FR')`, donc un score négatif comptait vers un trait d'union — dans le chiffre **et** dans l'`aria-label`. Le défaut passe sur `formatScore`. L'intention du § 13.4 (« format `fr-FR` ») est tenue, sa lettre non.                     |
| `quiz/Podium.tsx`         | L'`aria-label` de chaque colonne formatait le score en direct et le fichier redéclarait un `ordinalFr` local, copie de celui de `src/lib/format-fr.ts`. Les deux passent sur la bibliothèque.                                                                                                                                                  |
| `tokens/motion.css`       | Le bloc `prefers-reduced-motion` coupait les durées mais pas les **délais** : une entrée décalée (`qiRise … 210ms backwards`, cascade de la révélation, podium) restait à son image initiale — opacité 0 — pendant le délai, et l'écran s'affichait par morceaux. Ajout de `animation-delay: 0s` et `transition-delay: 0s`.                    |

`LeaderboardRow`, `CountUp`, `Podium` et `StageFrame` sont les seuls fichiers du kit qui importent
`src/lib` : c'est assumé, le formatage des nombres du produit n'ayant pas à exister en deux versions.

Nettoyage après la refonte : `CountUp.tsx` et `Podium.tsx` ne redéclarent plus leur
`prefersReducedMotion`, `StageFrame.tsx` plus son hook `matchMedia` (`useCompact`) — les trois
passent sur `src/lib/useMediaQuery.ts`, partagé avec le stage et l'éditeur. Comportement inchangé.

Le kit n'a **pas** de variante sombre de `Badge` et n'en reçoit pas : sur le stage, `tone="live"`
(fond `--state-danger`, encre blanche) et les pastilles claires `success` / `danger` de la liste
nominative se lisent comme des jetons posés sur le violet (pastille contre `--stage-bg` : 14,3:1 et
15,7:1). Le seul ton qui ne passait pas — `neutral`, pensé pour l'app claire — a son gabarit de page
`StageBadge` depuis le lot 2 (`--stage-control` / `--stage-border-strong` / `--stage-ink`).

## Patchs du lot 6 (interface multilingue)

| Fichier                   | Patch                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quiz/LeaderboardRow.jsx` | L'import passe de `src/lib/format-fr.ts` à `src/lib/format.ts` — même `formatScore`, mais la langue active décide désormais du séparateur de milliers. Aucun autre changement.                                                                                                                               |
| `motion/CountUp.tsx`      | Même repointage d'import. Le `aria-label` du compteur suit donc la langue, sans que le composant connaisse i18next.                                                                                                                                                                                          |
| `quiz/Podium.tsx`         | Même repointage (`ordinalFr` devient `ordinal`, localisé par `Intl.PluralRules`), et l'`aria-label` de chaque colonne prend le mot « points » dans `common:units.points` via `useTranslation`. C'est le seul fichier de `design-system/` qui importe react-i18next : il est local (§ 13.3), pas issu du kit. |

`Timer.jsx` garde son `aria-label` français en dur, **non patché** : il pose son attribut avant
`{...rest}`, donc `QuestionCard` et `StageQuestion` le recouvrent avec `common:timer.remainingAria`.
Le kit reste identique au skill. `Tag.jsx` a lui aussi un `aria-label="Retirer"` en dur, mais il
n'est rendu qu'avec `onRemove`, qu'aucun appel du produit ne passe.

`Wordmark` écrit « Quizint » : c'est la marque, elle ne se traduit pas.

### Ratios de contraste (calculés depuis `tokens/colors.css`)

Texte courant, contre les trois fonds du produit :

| Encre                                | `--surface-page` | `--surface-card` | `--stage-bg` |
| ------------------------------------ | ---------------- | ---------------- | ------------ |
| `--text-primary` / `--stage-ink`     | 18,2:1           | 19,3:1           | 14,3:1       |
| `--text-secondary` / `--stage-ink-2` | 6,6:1            | 7,0:1            | 7,6:1        |
| `--text-muted`                       | 4,6:1            | 4,9:1            | —            |
| `--text-brand` / `--brand-300`       | 10,4:1           | 11,1:1           | 7,1:1        |
| `--state-danger`                     | 5,2:1            | 5,5:1            | —            |

Tout le texte courant est au-dessus de 4,5:1, sur les trois fonds. Deux réserves, toutes deux
héritées des valeurs du skill et laissées telles quelles (aucune décision de palette au lot 5) :

- l'encre d'un `Badge` sur **sa propre** pastille tombe sous 4,5:1 pour `success` (3,7:1),
  `warning` (2,6:1) et `danger` (4,5:1 à l'arrondi) — le libellé y est court et redondant avec
  l'icône, mais c'est un écart à trancher ;
- `--focus-ring` (`rgba(115,81,163,.34)`) ne contraste qu'à 1,6:1 avec les fonds clairs et 1,4:1
  avec `--stage-bg`, sous les 3:1 attendus d'un indicateur non textuel. L'anneau est posé
  globalement par `tokens/base.css` (`:focus-visible`), donc présent sur **tous** les contrôles ;
  c'est sa teinte, pas sa présence, qui est en cause.
