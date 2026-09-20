// English counterpart of `fr/common.ts`. English typography takes no space before `? ! : ;` or `%`,
// so the keys that carry one in French carry none here.

export default {
  loading: 'Loading…',
  reconnecting: 'Reconnecting…',

  language: {
    label: 'Language',
    change: 'Change language',
  },

  actions: {
    cancel: 'Cancel',
    submit: 'Submit',
    join: 'Join',
  },

  units: {
    participant_one: 'participant',
    participant_other: 'participants',
    question_one: 'question',
    question_other: 'questions',
    answer_one: 'answer',
    answer_other: 'answers',
    correct_one: 'correct',
    correct_other: 'correct',
    connected_one: 'connected',
    connected_other: 'connected',
    active_one: 'active',
    active_other: 'active',
    points: 'points',
    pts: 'pts',
    seconds: 's',
  },

  questionType: {
    MCQ: 'Multiple choice',
    TRUE_FALSE: 'True or false',
    NUMERIC: 'Numeric answer',
    POLL: 'Poll',
    TEXT_POLL: 'Open-text poll',
  },

  api: {
    serverError: 'Server error',
    badRequest: 'Request refused',
  },

  timer: {
    remainingAria_one: '{{count}} second remaining',
    remainingAria_other: '{{count}} seconds remaining',
  },

  question: {
    label: 'Question',
    progressAria: 'Question {{current}} of {{total}}',
  },

  card: {
    yourAnswer: 'Your answer',
    yourNumericAnswer: 'Your numeric answer',
    textPlaceholder: 'Type your answer',
    recorded: 'Answer recorded',
    choicesGroup: 'Answer choices',
    choiceAria: 'Choice {{letter}}: {{label}}',
    hiddenAudio: 'Listen to the clip played in the room',
    hiddenImage: 'Look at the room screen',
    errorClosed: 'The question is closed.',
    errorTooLong: 'Enter an answer of {{max}} characters at most.',
    errorGeneric: 'Could not send, please try again.',
  },

  textAnswers: {
    empty: 'No answer',
    listLabel: 'Participants’ answers',
    countAria: '{{count}} times',
  },

  image: {
    zoomIn: 'Show the image full screen',
    zoomOut: 'Shrink the image',
  },

  skeleton: {
    loading: 'Loading',
    connecting: 'Connecting to the session…',
  },

  comingSoon: {
    title: 'Coming soon',
    body: 'The live quiz app is still being built. Come back soon to create your quizzes and run your live sessions.',
    action: 'In progress',
    brand: 'Quizint',
  },
};
