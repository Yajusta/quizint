// Participant journey (`/` and `/j/:code`): code entry, nickname, lobby, round result, final
// ranking, terminal states.
//
// `<num>` marks the digits inside a sentence: the screens render it as the mono `Num` span through
// `<Trans>`, so a translation may move the number anywhere in the sentence.

import { NBSP } from '../../../lib/format.ts';

export default {
  joinCode: {
    title: 'Rejoindre une session',
    hint: 'Saisissez le code affiché à l’écran.',
    fieldLabel: 'Code de session',
    placeholder: 'ABC 123',
    lengthError: `Le code comporte <num>{{count}}</num>${NBSP}caractères.`,
    presenterLink: 'Espace présentateur',
  },

  nickname: {
    title: 'Rejoindre la salle',
    fieldLabel: 'Votre pseudonyme',
    fieldHint: 'Visible par les autres participants',
    placeholder: 'Camille',
    action: 'Rejoindre',
    minLength: `Le pseudonyme doit contenir au moins <num>{{count}}</num>${NBSP}caractères.`,
    roomCount_zero: 'Personne dans la salle pour l’instant',
    roomCount_one: 'personne déjà dans la salle',
    roomCount_other: 'personnes déjà dans la salle',
    errorTaken: 'Ce pseudonyme est déjà pris, choisissez-en un autre.',
    errorInvalid: `Entre <num>{{min}}</num> et <num>{{max}}</num>${NBSP}caractères${NBSP}: lettres, chiffres, espaces ou tirets.`,
    errorNotFound: 'Aucune session avec ce code.',
    errorClosed: 'La session est terminée.',
    errorFull: 'La session est complète.',
    errorGeneric: 'Impossible de rejoindre pour le moment, réessayez.',
  },

  lobby: {
    title: 'Vous êtes dans la salle',
    waiting: 'En attente du présentateur',
  },

  roundResult: {
    footerNext: 'En attente de la question suivante',
    titleCorrect: 'Bonne réponse',
    titleWrong: 'Raté',
    titleNone: 'Pas de réponse',
    titlePoll: 'Merci pour votre avis',
    expectedLabel: `Réponse attendue${NBSP}:`,
    speedBonus: 'dont <num>{{points}}</num> de rapidité',
    score: 'Score',
    rank: 'Rang',
    closedTitle: 'La question est terminée',
    closedFooter: 'En attente du résultat',
    quizOverTitle: 'Le quiz est terminé',
    quizOverFooter: 'En attente du classement',
  },

  final: {
    footer: 'Merci d’avoir participé.',
    yourResult: 'Votre résultat',
    podium: 'Podium',
  },

  terminal: {
    action: 'Rejoindre une autre session',
    notFoundTitle: 'Aucune session avec ce code',
    notFoundDescription: 'Vérifiez le code affiché à l’écran de la salle.',
    endedTitle: 'La session est terminée',
    endedDescription: 'Merci d’avoir participé.',
    kickedTitle: 'Vous avez été retiré de la session',
    kickedDescription: 'Le présentateur a fermé votre accès à cette salle.',
    replacedTitle: 'Session ouverte sur un autre appareil',
    replacedDescription:
      'Votre place est passée sur un autre onglet ou appareil. Reprenez-la ici pour continuer sur celui-ci.',
    reclaimAction: 'Continuer ici',
  },
};
