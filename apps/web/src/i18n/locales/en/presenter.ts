// English counterpart of `fr/presenter.ts`.

export default {
  stage: {
    spaceKey: 'Space',
    fullscreenEnter: 'Full screen',
    fullscreenExit: 'Exit full screen',
    participants: 'Participants',
    end: 'End',
  },

  lobby: {
    kbd: 'Start',
    badge: 'Room open',
    title: 'Join the session',
    qrAlt: 'QR code to join the session',
    orType: 'or enter the code on <num>{{host}}</num>',
    empty: 'Participants show up here as soon as they join the room.',
    listLabel: 'Participants',
    startEmpty: 'Start with no participant',
    start: 'Start the quiz',
  },

  question: {
    kbd: 'Close',
    previousResult: 'Previous result',
    close: 'Close the question',
    numericTitle: 'Numeric answer expected',
    numericHint: 'Participants type a number on their phone.',
    textTitle: 'Open text',
    textHint: 'Participants type a word or a short sentence on their phone.',
    choicesLabel: 'Choices',
    choiceAria: 'Choice {{letter}}: {{label}}',
    answered: 'have answered',
    speedBonus: 'speed bonus',
    resultsTitle: 'Results',
  },

  closed: {
    kbdNext: 'Next',
    kbdRanking: 'Ranking',
    back: 'Back to the question',
    next: 'Next question',
    seeRanking: 'See the ranking',
    fastest: 'Fastest:',
    showNames: 'Answers by name',
    top5Label: 'Intermediate ranking',
    top5: 'Top 5',
    distributionLabel: 'Answer distribution',
    distributionAria: '{{letter}}: {{label}}, {{percent}}% of the answers',
    distributionAriaCorrect: ', correct answer',
    noAnswers: 'No answer received',
    histogramAria: 'Answer histogram, {{answers}} answers, {{correct}} within the expected range',
    expectedValue: 'Expected answer',
    median: 'Median',
    correctAnswers: 'Correct answers',
    namesLabel: 'Answers by name',
    correctBadge: 'Correct',
    wrongBadge: 'Wrong',
  },

  final: {
    kbd: 'End',
    badge: 'Session over',
    title: 'Final ranking',
    empty: 'No participant ranked.',
    restLabel: 'Rest of the ranking',
    statsLabel: 'Session figures',
    participants: 'Participants',
    active_one: '<num>{{count}}</num> of them active',
    active_other: '<num>{{count}}</num> of them active',
    participation: 'Participation',
    averageScore: 'Average score',
    fastest: 'Fastest',
    noCorrect: 'No correct answer',
    bestQuestion: 'Best answered',
    worstQuestion: 'Worst answered',
    noScoredQuestion: 'No scored question',
    results: 'See the results',
    end: 'End the session',
  },

  ended: {
    title: 'Session over',
    description: 'Thanks for running this session.',
    history: 'See the history',
  },

  waiting: {
    results: 'Computing the results…',
    ranking: 'Computing the ranking…',
  },

  panel: {
    title: 'Participants',
    close: 'Close the panel',
    empty: 'No participant yet.',
    answered: 'Answered',
    answeredListAria: 'Answered, first to last',
    waiting: 'Waiting',
    waitingListAria: 'Waiting for an answer',
    offline: 'offline',
    kick: 'Remove {{name}}',
    qrAlt: 'QR code to join the session',
  },

  confirm: {
    startEmptyTitle: 'Start with no participant',
    startEmptyDescription:
      'Nobody has joined the session yet. The quiz will run without a single answer, to walk through it for instance. Participants joining along the way answer the following questions.',
    startEmptyAction: 'Start anyway',
    backTitle: 'Back to the previous result',
    backDescription:
      'The answers already given to this question will be lost and their points taken back. The question starts from scratch when you reopen it.',
    backAction: 'Back to the result',
    reopenTitle: 'Back to the question',
    reopenDescription:
      'Participants’ answers to this question will be lost and their points taken back. The question reopens with a fresh timer.',
    reopenAction: 'Back to the question',
    endTitle: 'End the session',
    endDescriptionFinal:
      'Participants will see the session as over. The ranking stays available in the history.',
    endDescriptionRunning: 'The quiz stops now for every participant. Answers already recorded are kept.',
    endAction: 'End the session',
    kickTitle: 'Remove {{name}}',
    kickDescription: 'This participant will no longer be able to answer or rejoin with this nickname.',
    kickAction: 'Remove',
  },
};
