# Quiz — Design System

A design system for an **interactive quiz application** with two distinct surfaces:

- **Présentateur** — a desktop web app to build quizzes, run a live session and show results as they come in. It has two chromes: the *app* (light, dense, side rail) and the *stage* (dark, projected on a screen or shared over video).
- **Participant** — a mobile web view: join with a code, read the question, answer, see the outcome and the ranking.

Both are French-language products. The system is deliberately sober: one brand colour, a graphite neutral ramp, four fixed answer-channel colours, no gradients, no illustration, no decoration that isn't load-bearing.

## Sources

None were provided. The brief was a short prose description of the product ("Application de quiz interactif… sobre, mais moderne") with no codebase, Figma file, deck, logo or font binaries attached. Everything here is authored from that brief, so treat it as a **proposal to review**, not a recreation. If a real product, repo or Figma file exists, attach it and this system should be rebuilt against it.

Known substitutions, all flagged for the user:
- **Brand colour**: violet encre `#4A2E6B` — chosen after emerald and blue were rejected as generic; it is deliberately outside the green/red/amber semantic families so it cannot be mistaken for a result state. Alternatives if you want to push further: bleu de Prusse `#23395B`, terre brûlée `#9A4A25`, graphite `#1B1E24` with a single warm accent.
- **Type**: Space Grotesk / Instrument Sans / JetBrains Mono from Google Fonts (CDN), chosen as the sober-modern pairing. No brand fonts were supplied.
- **Icons**: Lucide via CDN. No brand icon set was supplied.
- **Logo**: none exists. The name is set in plain type wherever a mark would go (see `assets/README.md`).
- **Product name**: "Quiz" is a placeholder.

---

## Content fundamentals

**Language.** French, always. Non-breaking space before `?` `!` `:` and inside numbers (`1 006 km`, `8 420` points). Decimal comma (`6,4 s`).

**Voice.** Matter-of-fact and instructional. The interface states what is happening or what to do, and stops. No exclamation marks outside the participant's result moment, no jokes, no gamified hype ("Bravo champion !"), no emoji anywhere.

**Person.** The presenter app is impersonal and imperative — labels are nouns (`Mes quiz`, `Réglages de la session`), actions are verbs in the infinitive (`Lancer la session`, `Ajouter une question`, `Exporter les résultats`). The participant app addresses the user as **vous** (`Rejoindre une session`, `Vous êtes dans la salle`, `Votre pseudonyme`), and the participant's own leaderboard row is literally labelled `Vous`.

**Casing.** Sentence case everywhere — headings, buttons, labels, badges (`Bonne réponse`, not `BONNE RÉPONSE`). The single exception is the overline style (`--text-overline`), uppercase with `--tracking-wide`, used for micro-context above a block: `QUESTION 7 / 12`, `CODE DE SESSION`.

**Length.** Buttons 1–3 words. Field labels 1–4 words, hints one short sentence (`Visible par les autres participants`). Empty states are two lines: what's missing, then what to do (`Aucun quiz pour l'instant` / `Créez un premier quiz pour lancer une session.`).

**Numbers are content.** Counts, scores, codes, durations and percentages always render in JetBrains Mono so they stay legible at a glance and don't shift width as they tick.

**Feedback copy.** Neutral and factual: `Bonne réponse` / `Raté`, followed by the explanation the presenter wrote. The score change is a bare figure (`+ 940`). Never scold, never congratulate at length.

---

## Visual foundations

**Colour.** One brand colour — a violet encre / aubergine (`--brand-700 #4A2E6B`) for every primary action, selected state and brand tint; `--brand-600` on hover. Neutrals are a cool graphite ramp (`--gray-50 → --gray-950`), never pure black for text (`--text-primary` is `#0C0E10`). Semantic colours are used only for meaning: green correct, amber attention, red error/destructive/live, blue information. Because the brand colour is neither green nor red, correctness never competes with brand chrome.

**Answer options carry no colour of their own.** A proposition is neutral — white ground, grey letter tile — so every colour on an answer means something. During the question there are two states only: *proposition* and *sélection* (brand border + brand letter tile). Once the answer is revealed, two more appear: *bonne réponse* (green) and *mauvaise réponse* (red), with everything else dropped to *muted* (grey, 70%). Tokens: `--answer-rest-*`, `--answer-selected-*`, `--answer-correct-*`, `--answer-wrong-*` — each read with a literal fallback (`var(--answer-rest-tile, #EFF1F3)`) so a stale bundle or a copied snippet can never render a letter invisible. The previous per-letter channel tokens (`--answer-a…-d`) were removed; consumers still referencing them must migrate to the state tokens. Consequence: the letter A–D is the only stable identifier shared by the projected screen and the participant's phone, so letters are always visible on both.

**Two grounds, no third.** Light app on `--surface-page #F7F8F9` with white cards; projected stage on `--stage-bg` (`--brand-900 #10294A`) with `--stage-ink #E9F1FA`. There is no dark mode for the app and no light mode for the stage.

**Type.** Space Grotesk for display (`--text-display-1` 64px, questions 40px, headings 32/24) with `-0.02em` tracking; Instrument Sans for body and UI (17/15/13, line-height 1.5–1.55); JetBrains Mono for anything numeric. Questions on the stage never drop below 40px; participant question text is 26px.

**Backgrounds.** Flat colour only. No gradients, no photography, no illustration, no texture, no pattern. Depth comes from a 1px border plus a small shadow. Question media, when a quiz has it, is a plain slot the presenter fills; it is never decorated.

**Borders.** 1px `--border-subtle` on cards, 1px `--border-default` on fields, 2px brand or semantic border on selected or resolved answer options. On the stage, borders become `rgba(255,255,255,.12–.28)` rather than a lighter solid colour.

**Corner radii.** 4 micro (checkbox), 6 small controls and tags, 10 fields/buttons/icon buttons, 14 cards and answer options, 20 stage panels, 28 the phone frame, full pills for badges and player chips.

**Elevation.** Three steps and no more: `--shadow-1` at rest, `--shadow-2` on hover, `--shadow-3` for modals; `--shadow-stage` only under the projected frame. Shadows never stack — a card inside a card drops to `elevation={0}`. Pressed controls use an inset shadow instead of a bigger one.

**States.** Hover *lightens* fills (`brand-700 → brand-600`) and lifts neutral surfaces to `--gray-50`/`--gray-100`; answer options lift 1px with `--shadow-2`. Press insets (`--shadow-inset-press`) and nudges 1px down — nothing scales. Focus is always the brand ring `--focus-ring` (3px, 32% alpha), never a browser outline. Disabled is `--gray-100` fill with `--text-muted` ink and a subtle border, never reduced opacity on a coloured fill. After a reveal, unchosen answers go to `state="muted"` (60% opacity on a grey ground) rather than disappearing.

**Motion.** `--ease-out cubic-bezier(.2,.8,.2,1)` for essentially everything. 120ms hover/focus, 200ms toggles and panels, 320ms distribution bars and progress, 600ms stage transitions. `--ease-spring` exists for score reveals only. No bounce on UI chrome, no looping animation, no parallax; the countdown ring moves linearly (1s steps) so it reads as a clock, not an animation.

**Transparency and blur.** Only on the dark stage, and only as white alpha (`.06` fills, `.12–.28` borders, `.66–.8` secondary ink). `--blur-panel` is reserved for a panel floating over the stage; the light app never uses blur or translucency.

**Layout.** Presenter app: fixed 232px side rail, content capped at `--max-content 1160px`, 32px page gutters. Editor is a three-pane 280 / fluid / 300 grid. Stage: full-bleed, vertically centred, 80px gutters, with a fixed footer bar holding progress and the presenter's one next action. Participant: single column, 24px gutters, controls 52–64px tall (44px absolute minimum for touch), primary action full-width at the bottom of the flow.

**Cards.** White, 1px `--border-subtle`, 14px radius, `--shadow-1`, 24px padding; optional header (1px divider, 19px semibold) and footer (`--gray-50` ground). Selected cards take a brand border plus a 3px `--brand-50` ring — never a coloured left border.

**Imagery vibe.** No brand imagery exists. If photography is ever added, the intent is cool, neutral, low-contrast and un-stylised, sitting inside a 14px-radius frame with no overlay gradient; protection is provided by the flat dark ground, not by a scrim.

---

## Iconography

**Lucide**, loaded from CDN (`lucide-static@0.441.0`) — a substitution, since no brand icon set was supplied. Everything goes through the `Icon` component, which renders the SVG as a CSS mask so glyphs inherit `currentColor` and can sit on either ground without a second asset.

- Sizes: 14 (`sm`, inline with 13px text), 18 (`md`, buttons and nav), 22 (`lg`, empty states and reveal marks), 28 (`xl`).
- Stroke-based, 1.5–2px, never filled, never multi-colour, never in a coloured circle except the 48px empty-state badge (`--brand-50` ground, `--brand-700` glyph).
- Icons are decorative (`aria-hidden`) and always paired with a label, except in `IconButton`, which requires `label` for its accessible name and tooltip.
- Working set: `play`, `square`, `timer`, `users`, `bar-chart-3`, `check`, `x`, `pencil`, `trash-2`, `plus`, `library`, `history`, `settings`, `chevron-down`, `chevron-right`, `arrow-left/right/up/down`, `search`, `eye`, `download`, `rotate-ccw`, `qr-code`, `list-plus`, `archive`, `circle-help`.
- **No emoji, ever** — not in UI, not in copy, not as a stand-in for an icon. No unicode symbols as icons either (`→` in copy is fine, `✓` as a status mark is not; use `Icon`).

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | Global entry point — `@import` list only. Consumers link this one file. |
| `tokens/` | `fonts`, `colors`, `typography`, `spacing`, `radius`, `elevation`, `motion`, `base` |
| `guidelines/` | 19 specimen cards (Colors, Type, Spacing, Brand) |
| `components/core/` | `Icon`, `Button`, `IconButton`, `Card`, `Badge`, `Tag` |
| `components/forms/` | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` |
| `components/feedback/` | `ProgressBar`, `Timer`, `Dialog`, `EmptyState` |
| `components/navigation/` | `Tabs`, `Stepper`, `SideNav` |
| `components/quiz/` | `AnswerOption`, `QuestionDisplay`, `JoinCode`, `PlayerChip`, `LeaderboardRow`, `StatTile` |
| `ui_kits/presenter/` | Desktop app + projected stage, 5 screens, click-through |
| `ui_kits/participant/` | Mobile flow, 5 screens, click-through |
| `assets/` | Empty — see its README for the logo/icon/font situation |
| `SKILL.md` | Agent-skill entry point |

Every component ships `<Name>.jsx`, `<Name>.d.ts` (props contract) and `<Name>.prompt.md` (what & when + usage), with one `@dsCard` HTML per directory.

### Intentional additions

- **`Icon`** — a thin wrapper over Lucide so glyphs inherit `currentColor` on both grounds; without it every consumer would hand-roll SVG.
- **`Field`** — label/hint/error wrapper, so form copy rules are enforced in one place rather than per screen.
- The `components/quiz/` family (answer options, question display, join code, player chip, leaderboard row, stat tile) is product-specific rather than generic; it exists because these are the shapes the two surfaces are actually made of.
