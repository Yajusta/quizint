// CSV export (§7.2): UTF-8 BOM, ';' separator, \r\n, French decimals.
// Two kinds: scores and answers.

import type { Answer, Participant } from '@prisma/client';

interface SnapshotForCsv {
  questions: Array<{
    prompt: string;
    type: string;
    choices: Array<{ id: string; label: string; isCorrect: boolean }>;
    numericAnswer: { value: number; tolerance: number; toleranceMode?: 'ABSOLUTE' | 'PERCENT' } | null;
  }>;
}

export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  // ',' and tab are quoted too: a spreadsheet opened with another list separator must not split
  // the cell and turn its tail into a cell of its own that starts with '='.
  if (/[";,\t\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Characters a spreadsheet may skip before it looks for a formula trigger: ASCII whitespace and
 * control characters, no-break and typographic spaces, zero-width characters and a stray BOM.
 */
const FORMULA_LEADING_NOISE = /^[\s\p{Cc}\p{Cf}\p{Zs}]*/u;
/** Formula triggers (OWASP CSV injection), with the full-width forms some spreadsheets fold. */
const FORMULA_TRIGGERS = /^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/;
/** A value opening on one of these is suspicious on its own (OWASP: tab, CR, LF). */
const FORMULA_LEADING_CONTROL = /^[\t\r\n]/;

/**
 * Authored text (prompt, choice label, nickname, free answer) gets a leading quote when a
 * spreadsheet could read it as a formula (OWASP CSV injection): a trigger `= + - @` first, or
 * after leading blanks, control or invisible characters, or a value opening on tab, CR or LF.
 * Not applied to the numbers `fr()` prints: «-5» stays.
 */
export function formulaSafe(text: string): string {
  const unpadded = text.replace(FORMULA_LEADING_NOISE, '');
  return FORMULA_LEADING_CONTROL.test(text) || FORMULA_TRIGGERS.test(unpadded) ? `'${text}` : text;
}

function fr(n: number): string {
  // French decimal convention with comma, no grouping (CSV-safe).
  const fixed = Math.round(n * 1000) / 1000;
  return String(fixed).replace('.', ',');
}

/**
 * Choice answers show the label (not the raw uuid); numeric answers use FR decimals; free text is
 * exported as typed. Labels and free text go through `formulaSafe`.
 */
function answerDisplay(payload: unknown, question: SnapshotForCsv['questions'][number]): string {
  const p = payload as { choiceId?: string; value?: number; text?: string } | null;
  if (!p) return '';
  if (p.choiceId) {
    return formulaSafe(question.choices.find((c) => c.id === p.choiceId)?.label ?? p.choiceId);
  }
  if ('value' in p && p.value !== undefined) return fr(p.value);
  if (typeof p.text === 'string') return formulaSafe(p.text);
  return '';
}

/** `ranking` rows come from the shared `buildRanking` (rank set) followed by kicked rows (rank null). */
export function buildScoresCsv(
  ranking: Array<{
    participantId: string;
    nickname: string;
    score: number;
    rank: number | null;
    isKicked: boolean;
  }>,
  answersByParticipant: Map<string, { correct: number; given: number; correctElapsedMs: number }>,
): string {
  const lines: string[] = [];
  lines.push(
    [
      'rang',
      'pseudo',
      'score',
      'bonnes_reponses',
      'reponses_donnees',
      'temps_total_bonnes_reponses_s',
      'exclu',
    ]
      .map(csvCell)
      .join(';'),
  );
  for (const row of ranking) {
    const stats = answersByParticipant.get(row.participantId) ?? {
      correct: 0,
      given: 0,
      correctElapsedMs: 0,
    };
    lines.push(
      [
        row.rank === null ? '' : String(row.rank),
        csvCell(formulaSafe(row.nickname)),
        row.score,
        stats.correct,
        stats.given,
        fr(stats.correctElapsedMs / 1000),
        row.isKicked ? 'oui' : 'non',
      ].join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** `session.answers` must be ordered by questionIndex, then answeredAt. */
export function buildAnswersCsv(session: {
  quizSnapshot: unknown;
  answers: Answer[];
  participants: Participant[];
}): string {
  const snapshot = session.quizSnapshot as SnapshotForCsv;
  const nicknameById = new Map(session.participants.map((p) => [p.id, p.nickname]));

  const lines: string[] = [];
  lines.push(
    [
      'numero_question',
      'type',
      'enonce',
      'pseudo',
      'reponse',
      'bonne_reponse',
      'correct',
      'points_base',
      'points_bonus',
      'points',
      'temps_reponse_s',
      'horodatage',
    ]
      .map(csvCell)
      .join(';'),
  );

  for (const a of session.answers) {
    const question = snapshot.questions[a.questionIndex];
    if (!question) continue;
    const correctLabel =
      question.type === 'POLL' || question.type === 'TEXT_POLL'
        ? ''
        : question.type === 'NUMERIC'
          ? question.numericAnswer && question.numericAnswer.tolerance > 0
            ? // A PERCENT tolerance is a percentage of the expected value, not an absolute bound.
              `${fr(question.numericAnswer.value)} (± ${fr(question.numericAnswer.tolerance)}${
                question.numericAnswer.toleranceMode === 'PERCENT' ? ' %' : ''
              })`
            : fr(question.numericAnswer?.value ?? 0)
          : formulaSafe(question.choices.find((c) => c.isCorrect)?.label ?? '');

    lines.push(
      [
        a.questionIndex + 1,
        question.type,
        csvCell(formulaSafe(question.prompt)),
        csvCell(formulaSafe(nicknameById.get(a.participantId) ?? '?')),
        csvCell(answerDisplay(a.payload, question)),
        csvCell(correctLabel),
        a.isCorrect === null ? '' : a.isCorrect ? 'oui' : 'non',
        a.pointsBase,
        a.pointsBonus,
        a.pointsAwarded,
        fr(a.elapsedMs / 1000),
        new Date(a.answeredAt).toISOString(),
      ].join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
