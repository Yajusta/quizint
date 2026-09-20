// English counterpart of `fr/participant.ts`.

export default {
  joinCode: {
    title: 'Join a session',
    hint: 'Enter the code shown on the room screen.',
    fieldLabel: 'Session code',
    placeholder: 'ABC 123',
    lengthError: 'The code is <num>{{count}}</num> characters long.',
    presenterLink: 'Presenter area',
  },

  nickname: {
    title: 'Join the room',
    fieldLabel: 'Your nickname',
    fieldHint: 'Visible to the other participants',
    placeholder: 'Camille',
    action: 'Join',
    minLength: 'Your nickname must be at least <num>{{count}}</num> characters long.',
    roomCount_zero: 'Nobody in the room yet',
    roomCount_one: 'person already in the room',
    roomCount_other: 'people already in the room',
    errorTaken: 'That nickname is already taken, please pick another one.',
    errorInvalid:
      'Between <num>{{min}}</num> and <num>{{max}}</num> characters: letters, digits, spaces or hyphens.',
    errorNotFound: 'No session with that code.',
    errorClosed: 'The session is over.',
    errorFull: 'The session is full.',
    errorGeneric: 'Cannot join right now, please try again.',
  },

  lobby: {
    title: 'You are in the room',
    waiting: 'Waiting for the presenter',
  },

  roundResult: {
    footerNext: 'Waiting for the next question',
    titleCorrect: 'Correct',
    titleWrong: 'Missed',
    titleNone: 'No answer',
    titlePoll: 'Thanks for your answer',
    expectedLabel: 'Expected answer:',
    speedBonus: 'including <num>{{points}}</num> for speed',
    score: 'Score',
    rank: 'Rank',
    closedTitle: 'The question is closed',
    closedFooter: 'Waiting for your result',
    quizOverTitle: 'The quiz is over',
    quizOverFooter: 'Waiting for the ranking',
  },

  final: {
    footer: 'Thanks for taking part.',
    yourResult: 'Your result',
    podium: 'Podium',
  },

  terminal: {
    action: 'Join another session',
    notFoundTitle: 'No session with that code',
    notFoundDescription: 'Check the code shown on the room screen.',
    endedTitle: 'The session is over',
    endedDescription: 'Thanks for taking part.',
    kickedTitle: 'You were removed from the session',
    kickedDescription: 'The presenter closed your access to this room.',
  },
};
