// Projected stage (`/present/:sessionId`): lobby, open question, reveal, final ranking, the
// participants panel and the confirmation dialogs.

import { NBSP } from '../../../lib/format.ts';

export default {
  stage: {
    spaceKey: 'Espace',
    fullscreenEnter: 'Plein écran',
    fullscreenExit: 'Quitter le plein écran',
    participants: 'Participants',
    end: 'Terminer',
  },

  lobby: {
    kbd: 'Démarrer',
    badge: 'Salle ouverte',
    title: 'Rejoignez la session',
    qrAlt: 'QR code pour rejoindre la session',
    orType: 'ou saisissez le code sur <num>{{host}}</num>',
    empty: 'Les participants apparaissent ici dès qu’ils rejoignent la salle.',
    listLabel: 'Participants',
    startEmpty: 'Démarrer sans participant',
    start: 'Démarrer le quiz',
  },

  question: {
    kbd: 'Clore',
    previousResult: 'Résultat précédent',
    close: 'Clore la question',
    numericTitle: 'Réponse numérique attendue',
    numericHint: 'Les participants saisissent un nombre sur leur téléphone.',
    textTitle: 'Réponse libre',
    textHint: 'Les participants saisissent un mot ou une courte phrase sur leur téléphone.',
    choicesLabel: 'Propositions',
    choiceAria: `Proposition {{letter}}${NBSP}: {{label}}`,
    answered: 'ont répondu',
    speedBonus: 'bonus rapidité',
    resultsTitle: 'Résultats',
  },

  closed: {
    kbdNext: 'Suivant',
    kbdRanking: 'Classement',
    back: 'Revenir à la question',
    next: 'Question suivante',
    seeRanking: 'Voir le classement',
    fastest: `Plus rapide${NBSP}:`,
    showNames: 'Réponses nominatives',
    top5Label: 'Classement intermédiaire',
    top5: 'Top 5',
    distributionLabel: 'Répartition des réponses',
    distributionAria: `{{letter}}${NBSP}: {{label}}, {{percent}}${NBSP}% des réponses`,
    distributionAriaCorrect: ', bonne réponse',
    noAnswers: 'Aucune réponse reçue',
    histogramAria: `Histogramme des réponses, {{answers}}${NBSP}réponses, {{correct}} dans la plage attendue`,
    expectedValue: 'Réponse attendue',
    median: 'Médiane',
    correctAnswers: 'Bonnes réponses',
    namesLabel: 'Réponses nominatives',
    correctBadge: 'Correct',
    wrongBadge: 'Faux',
  },

  final: {
    kbd: 'Terminer',
    badge: 'Session terminée',
    title: 'Classement final',
    empty: 'Aucun participant classé.',
    restLabel: 'Suite du classement',
    statsLabel: 'Chiffres de la session',
    participants: 'Participants',
    active_one: 'dont <num>{{count}}</num> actif',
    active_other: 'dont <num>{{count}}</num> actifs',
    participation: 'Participation',
    averageScore: 'Score moyen',
    fastest: 'Plus rapide',
    noCorrect: 'Aucune bonne réponse',
    bestQuestion: 'La mieux réussie',
    worstQuestion: 'La moins réussie',
    noScoredQuestion: 'Aucune question notée',
    results: 'Voir les résultats',
    end: 'Terminer la session',
  },

  ended: {
    title: 'Session terminée',
    description: 'Merci d’avoir animé cette session.',
    history: 'Voir l’historique',
  },

  waiting: {
    results: 'Calcul des résultats…',
    ranking: 'Calcul du classement…',
  },

  panel: {
    title: 'Participants',
    close: 'Fermer le panneau',
    empty: 'Aucun participant pour l’instant.',
    answered: 'Ont répondu',
    answeredListAria: 'Ont répondu, du premier au dernier',
    waiting: 'En attente',
    waitingListAria: 'En attente de réponse',
    offline: 'hors ligne',
    kick: 'Retirer {{name}}',
    qrAlt: 'QR code pour rejoindre la session',
  },

  confirm: {
    startEmptyTitle: 'Démarrer sans participant',
    startEmptyDescription:
      'Personne n’a encore rejoint la session. Le quiz se déroulera sans aucune réponse, par exemple pour en montrer le déroulé. Les participants qui rejoignent en cours de route répondent aux questions suivantes.',
    startEmptyAction: 'Démarrer quand même',
    backTitle: 'Revenir au résultat précédent',
    backDescription:
      'Les réponses déjà données à cette question seront perdues et leurs points retirés. La question repartira de zéro quand vous la relancerez.',
    backAction: 'Revenir au résultat',
    reopenTitle: 'Revenir à la question',
    reopenDescription:
      'Les réponses des participants à cette question seront perdues et leurs points retirés. La question sera relancée avec un nouveau chronomètre.',
    reopenAction: 'Revenir à la question',
    endTitle: 'Terminer la session',
    endDescriptionFinal:
      'Les participants verront la session comme terminée. Le classement reste consultable dans l’historique.',
    endDescriptionRunning:
      'Le quiz s’arrête maintenant pour tous les participants. Les réponses déjà enregistrées sont conservées.',
    endAction: 'Terminer la session',
    kickTitle: 'Retirer {{name}}',
    kickDescription: 'Ce participant ne pourra plus répondre ni rejoindre la session avec ce pseudonyme.',
    kickAction: 'Retirer',
  },
};
