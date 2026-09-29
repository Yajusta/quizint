// Reference fixtures reused by front and back tests (lot 1, §13.3).
// A 6-question quiz covering all 4 types, with timer/bonus/malus.

import type { QuizSnapshot, SnapshotQuestion } from '../src/schemas/domain.js';

function id(n: number): string {
  const h = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${h}`;
}

function mcq(
  n: number,
  prompt: string,
  labels: string[],
  correctIndex: number,
  extra: Partial<SnapshotQuestion> = {},
): SnapshotQuestion {
  return {
    id: id(n),
    position: n,
    type: 'MCQ',
    prompt,
    explanation: null,
    media: null,
    mediaOnParticipants: true,
    pointsCorrect: 100,
    pointsWrong: 0,
    timeLimitSec: null,
    speedBonusMax: 0,
    choices: labels.map((label, i) => ({
      id: id(n * 100 + i + 1),
      position: i,
      label,
      media: null,
      isCorrect: i === correctIndex,
    })),
    numericAnswer: null,
    ...extra,
  };
}

function numeric(
  n: number,
  prompt: string,
  value: number,
  tolerance: number,
  extra: Partial<SnapshotQuestion> = {},
): SnapshotQuestion {
  return {
    id: id(n),
    position: n,
    type: 'NUMERIC',
    prompt,
    explanation: null,
    media: null,
    mediaOnParticipants: true,
    pointsCorrect: 100,
    pointsWrong: 0,
    timeLimitSec: null,
    speedBonusMax: 0,
    choices: [],
    numericAnswer: { value, tolerance, toleranceMode: 'ABSOLUTE' },
    ...extra,
  };
}

export const FIXTURE_QUIZ_SNAPSHOT: QuizSnapshot = {
  quizId: id(999),
  title: 'Culture data',
  description: 'Quiz de démonstration couvrant les quatre types de questions',
  snapshotAt: '2026-09-09T10:00:00.000Z',
  questions: [
    mcq(1, 'Quel format est colonnaire ?', ['CSV', 'Parquet', 'JSON'], 1, {
      timeLimitSec: 20,
      speedBonusMax: 50,
      pointsWrong: -25,
    }),
    numeric(2, 'Combien de bits dans un octet ?', 8, 0, {
      pointsCorrect: 50,
      timeLimitSec: 30,
    }),
    {
      id: id(3),
      position: 3,
      type: 'TRUE_FALSE',
      prompt: 'PostgreSQL est un SGBD NoSQL.',
      explanation: null,
      media: null,
      mediaOnParticipants: true,
      pointsCorrect: 100,
      pointsWrong: -25,
      timeLimitSec: null,
      speedBonusMax: 0,
      choices: [
        { id: id(301), position: 0, label: 'Vrai', media: null, isCorrect: false },
        { id: id(302), position: 1, label: 'Faux', media: null, isCorrect: true },
      ],
      numericAnswer: null,
    },
    {
      id: id(4),
      position: 4,
      type: 'POLL',
      prompt: 'Quel outil utilisez-vous le plus ?',
      explanation: null,
      media: null,
      mediaOnParticipants: true,
      pointsCorrect: 0,
      pointsWrong: 0,
      timeLimitSec: null,
      speedBonusMax: 0,
      choices: [
        { id: id(401), position: 0, label: 'Talend', media: null, isCorrect: false },
        { id: id(402), position: 1, label: 'Blueway', media: null, isCorrect: false },
        { id: id(403), position: 2, label: 'Autre', media: null, isCorrect: false },
      ],
      numericAnswer: null,
    },
    mcq(
      5,
      'Que signifie ETL ?',
      ['Extraire, Transformer, Charger', 'Évaluer, Tester, Livrer', 'Échanger, Transférer, Lier'],
      0,
      {
        timeLimitSec: 15,
        speedBonusMax: 25,
      },
    ),
    numeric(6, 'Quelle proportion de vos flux est documentée (en heures) ?', 3.5, 0.1, {
      pointsCorrect: 80,
      timeLimitSec: 45,
      speedBonusMax: 20,
    }),
  ],
};

export const FIXTURE_PARTICIPANT_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

export const FIXTURE_NICKNAMES: Readonly<Record<string, string>> = {
  p1: 'Marie',
  p2: 'Karim',
  p3: 'Éric',
  p4: 'Louise',
  p5: 'Yanis',
};

// ---------------------------------------------------------------------------
// Lot 1 (UX) — demo quiz covering the visual states of the plan § 11.3:
// 4-choice MCQ (bonus, malus), 6-choice MCQ + image, long statement, true/false, numeric, poll,
// hidden media. Served by the mock (`POST /mock/sessions { quiz: 'showcase' }`); the image points to
// `/uploads/mock-sample.svg`, which the mock serves itself. Do not use in business-rule tests.
// ---------------------------------------------------------------------------

const SHOWCASE_IMAGE = {
  kind: 'IMAGE' as const,
  url: '/uploads/mock-sample.svg',
  width: 640,
  height: 360,
  durationSec: null,
};

export const FIXTURE_QUIZ_SHOWCASE: QuizSnapshot = {
  quizId: id(998),
  title: 'Culture data',
  description: 'Quiz de démonstration UX — un écran par état du protocole visuel',
  snapshotAt: '2026-09-12T10:00:00.000Z',
  questions: [
    mcq(51, 'Quel format de fichier est colonnaire ?', ['CSV', 'Parquet', 'JSON', 'Avro'], 1, {
      timeLimitSec: 20,
      speedBonusMax: 50,
      pointsWrong: -25,
    }),
    mcq(
      52,
      'Parmi ces moteurs, lequel exécute des requêtes SQL distribuées directement sur un lac de données, sans chargement préalable ?',
      ['Trino', 'PostgreSQL', 'SQLite', 'Redis', 'MongoDB', 'Kafka'],
      0,
      {
        media: SHOWCASE_IMAGE,
        timeLimitSec: 30,
        speedBonusMax: 30,
        pointsWrong: -25,
        explanation:
          'Trino (ex-PrestoSQL) interroge directement les fichiers du lac — Parquet, ORC, Iceberg — via ses connecteurs, sans les charger dans une base au préalable. PostgreSQL et SQLite exigent un chargement, Redis et MongoDB ne parlent pas SQL, Kafka transporte des flux.',
      },
    ),
    {
      id: id(53),
      position: 53,
      type: 'TRUE_FALSE',
      prompt: 'PostgreSQL est un SGBD NoSQL.',
      explanation: 'PostgreSQL est un SGBD relationnel, même s’il sait aussi stocker du JSON (jsonb).',
      media: null,
      mediaOnParticipants: true,
      pointsCorrect: 100,
      pointsWrong: -25,
      timeLimitSec: null,
      speedBonusMax: 0,
      choices: [
        { id: id(5301), position: 0, label: 'Vrai', media: null, isCorrect: false },
        { id: id(5302), position: 1, label: 'Faux', media: null, isCorrect: true },
      ],
      numericAnswer: null,
    },
    numeric(54, 'Combien de bits dans un octet ?', 8, 0, {
      pointsCorrect: 50,
      timeLimitSec: 30,
      speedBonusMax: 20,
    }),
    {
      id: id(55),
      position: 55,
      type: 'POLL',
      prompt: 'Quel outil utilisez-vous le plus ?',
      explanation: null,
      media: null,
      mediaOnParticipants: true,
      pointsCorrect: 0,
      pointsWrong: 0,
      timeLimitSec: null,
      speedBonusMax: 0,
      choices: [
        { id: id(5501), position: 0, label: 'Talend', media: null, isCorrect: false },
        { id: id(5502), position: 1, label: 'Blueway', media: null, isCorrect: false },
        { id: id(5503), position: 2, label: 'dbt', media: null, isCorrect: false },
        { id: id(5504), position: 3, label: 'Autre', media: null, isCorrect: false },
      ],
      numericAnswer: null,
    },
    mcq(
      56,
      'Quel schéma de modélisation est affiché à l’écran ?',
      ['Étoile', 'Flocon', 'Voûte de données', 'Troisième forme normale'],
      0,
      { media: SHOWCASE_IMAGE, mediaOnParticipants: false, timeLimitSec: 20 },
    ),
    {
      id: id(57),
      position: 57,
      type: 'TEXT_POLL',
      prompt: 'En un mot, comment qualifieriez-vous vos flux de données ?',
      explanation: null,
      media: null,
      mediaOnParticipants: true,
      pointsCorrect: 0,
      pointsWrong: 0,
      timeLimitSec: null,
      speedBonusMax: 0,
      choices: [],
      numericAnswer: null,
    },
  ],
};
