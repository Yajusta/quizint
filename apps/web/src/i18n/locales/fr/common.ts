// Strings shared by several surfaces: question types, the live question card (participant + editor
// preview), the grouped text answers, the zoomable image, the skeletons.
//
// Plural keys hold the noun alone (`_one` / `_other`): the screens render the number themselves, in
// `--font-mono`, and only ask the dictionary for the word that follows it.

import { NBSP } from '../../../lib/format.ts';

export default {
  loading: 'Chargement…',
  reconnecting: 'Reconnexion…',

  language: {
    label: 'Langue',
    change: 'Changer de langue',
  },

  actions: {
    cancel: 'Annuler',
    submit: 'Valider',
    join: 'Rejoindre',
  },

  units: {
    participant_one: 'participant',
    participant_other: 'participants',
    question_one: 'question',
    question_other: 'questions',
    answer_one: 'réponse',
    answer_other: 'réponses',
    correct_one: 'correcte',
    correct_other: 'correctes',
    connected_one: 'connecté',
    connected_other: 'connectés',
    active_one: 'actif',
    active_other: 'actifs',
    points: 'points',
    pts: 'pts',
    seconds: 's',
  },

  questionType: {
    MCQ: 'QCM',
    TRUE_FALSE: 'Vrai ou faux',
    NUMERIC: 'Réponse numérique',
    POLL: 'Sondage',
    TEXT_POLL: 'Sondage à réponse libre',
  },

  api: {
    serverError: 'Erreur serveur',
    badRequest: 'Requête refusée',
  },

  timer: {
    remainingAria_one: '{{count}} seconde restante',
    remainingAria_other: '{{count}} secondes restantes',
  },

  question: {
    label: 'Question',
    progressAria: 'Question {{current}} sur {{total}}',
  },

  card: {
    yourAnswer: 'Votre réponse',
    yourNumericAnswer: 'Votre réponse numérique',
    textPlaceholder: 'Saisissez votre réponse',
    recorded: 'Réponse enregistrée',
    choicesGroup: 'Choix de réponse',
    choiceAria: `Choix {{letter}}${NBSP}: {{label}}`,
    hiddenAudio: 'Écoutez l’extrait diffusé dans la salle',
    hiddenImage: 'Regardez l’écran de la salle',
    errorClosed: 'La question est terminée.',
    errorTooLong: `Saisissez une réponse de {{max}}${NBSP}caractères au plus.`,
    errorGeneric: 'Envoi impossible, réessayez.',
  },

  textAnswers: {
    empty: 'Aucune réponse',
    listLabel: 'Réponses des participants',
    countAria: `{{count}}${NBSP}fois`,
  },

  image: {
    zoomIn: 'Afficher l’image en plein écran',
    zoomOut: 'Réduire l’image',
  },

  skeleton: {
    loading: 'Chargement',
    connecting: 'Connexion à la session…',
  },

  comingSoon: {
    title: 'Bientôt disponible',
    body: 'L’application Quizint est en cours de construction. Revenez bientôt pour créer vos quiz et animer vos sessions en direct.',
    action: 'En préparation',
    brand: 'Quizint',
  },
};
