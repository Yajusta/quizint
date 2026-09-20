// Lot 3 — Back-office: visual protocol § 11 (matrix § 11.3, viewports § 11.2).
//
// Prerequisite, unlike lots 1 and 2: the back-office talks to the **real API** (REST +
// authentication cookie), not to the socket mock.
//
//   pnpm --filter @quiz/api db:migrate && pnpm --filter @quiz/api db:seed
//   pnpm --filter @quiz/api dev                                   # API :3000
//   pnpm --filter @quiz/web exec vite --port 5175 --strictPort    # web, proxies /api to :3000
//   E2E_BASE_URL=http://localhost:5175 pnpm --filter @quiz/web exec playwright test e2e/admin.spec.ts
//
// `seed()` puts the database back into a known state on every run (purge then recreate), so the
// demo data set is reproducible: 6 quizzes (including an empty one and one with 12 questions), two
// sessions open in the lobby and two sessions played through to the end by bots.

import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import type { Socket } from 'socket.io-client';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  api,
  shot,
  VIEWPORTS,
  watchForErrors,
  type ViewportName,
} from './helpers';
import { connect as connectTo, emitAck } from './mock-driver';

const LOT = 'admin';
const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000';

// --- Demo data set ----------------------------------------------------------------------

interface SeedChoice {
  label: string;
  isCorrect: boolean;
}
interface SeedQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'NUMERIC' | 'POLL';
  prompt: string;
  choices: SeedChoice[];
  numericAnswer: { value: number; tolerance: number; toleranceMode: 'ABSOLUTE' } | null;
}

function mcq(prompt: string, labels: string[], correct: number): SeedQuestion {
  return {
    type: 'MCQ',
    prompt,
    choices: labels.map((label, i) => ({ label, isCorrect: i === correct })),
    numericAnswer: null,
  };
}
function trueFalse(prompt: string, answer: boolean): SeedQuestion {
  return {
    type: 'TRUE_FALSE',
    prompt,
    choices: [
      { label: 'Vrai', isCorrect: answer },
      { label: 'Faux', isCorrect: !answer },
    ],
    numericAnswer: null,
  };
}
function numeric(prompt: string, value: number, tolerance: number): SeedQuestion {
  return {
    type: 'NUMERIC',
    prompt,
    choices: [],
    numericAnswer: { value, tolerance, toleranceMode: 'ABSOLUTE' },
  };
}
function poll(prompt: string, labels: string[]): SeedQuestion {
  return {
    type: 'POLL',
    prompt,
    choices: labels.map((label) => ({ label, isCorrect: false })),
    numericAnswer: null,
  };
}

/** The played quiz: one of each type, so that « Détail de session » shows every reading. */
const HISTOIRE: SeedQuestion[] = [
  mcq('En quelle année la Première Guerre mondiale prend-elle fin ?', ['1916', '1917', '1918', '1919'], 2),
  trueFalse('La prise de la Bastille a eu lieu le 14 juillet 1789.', true),
  numeric('Combien de rois de France se sont appelés Louis ?', 18, 1),
  mcq(
    'Qui a fait construire le château de Versailles dans sa forme actuelle ?',
    ['François Ier', 'Henri IV', 'Louis XIV', 'Napoléon Ier'],
    2,
  ),
  poll('Quelle période vous intéresse le plus ?', [
    'Le Moyen Âge',
    'La Renaissance',
    'La Révolution',
    'Le XXe siècle',
  ]),
];

const GEOGRAPHIE: SeedQuestion[] = [
  mcq('Quel est le plus long fleuve du monde ?', ['Le Nil', 'L’Amazone', 'Le Yangzi', 'Le Mississippi'], 1),
  mcq('Quelle est la capitale de l’Australie ?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2),
  trueFalse('Le Groenland est un territoire autonome danois.', true),
  numeric('Combien de pays composent l’Union européenne ?', 27, 0),
  mcq('Quel désert couvre la plus grande surface ?', ['Le Sahara', 'Le Gobi', 'L’Atacama', 'Le Kalahari'], 0),
  poll('Quelle destination vous attire le plus ?', ['L’Islande', 'Le Japon', 'Le Pérou', 'La Namibie']),
];

const SCIENCES: SeedQuestion[] = [
  mcq('Quel est le symbole chimique du fer ?', ['F', 'Fe', 'Ir', 'Fr'], 1),
  trueFalse('Le son se propage plus vite dans l’eau que dans l’air.', true),
  numeric('Combien de planètes compte le système solaire ?', 8, 0),
  mcq('Quel organe produit l’insuline ?', ['Le foie', 'Le pancréas', 'La rate', 'Le rein'], 1),
];

const CINEMA: SeedQuestion[] = [
  mcq('Qui a réalisé « Pulp Fiction » ?', ['Martin Scorsese', 'Quentin Tarantino', 'Joel Coen'], 1),
  trueFalse('« Titanic » est sorti en 1997.', true),
  mcq('Quel film a remporté l’Oscar du meilleur film en 1994 ?', ['Forrest Gump', 'Le Roi lion', 'Speed'], 0),
];

/** Twelve questions: the « long » card of the library and real scrolling in the editor. */
const CULTURE: SeedQuestion[] = [
  mcq('Combien de cordes compte un violon ?', ['3', '4', '5', '6'], 1),
  mcq('Quelle planète est la plus proche du Soleil ?', ['Vénus', 'Mercure', 'Mars', 'La Terre'], 1),
  trueFalse('Le mont Blanc culmine à plus de 4 800 mètres.', true),
  mcq('Qui a peint « La Nuit étoilée » ?', ['Monet', 'Van Gogh', 'Cézanne', 'Gauguin'], 1),
  numeric('En quelle année la tour Eiffel a-t-elle été inaugurée ?', 1889, 2),
  mcq('Quelle langue compte le plus de locuteurs natifs ?', ['L’anglais', 'Le mandarin', 'L’espagnol'], 1),
  trueFalse('Une année bissextile compte 366 jours.', true),
  mcq('Quel est le plus grand océan ?', ['L’Atlantique', 'L’Indien', 'Le Pacifique', 'L’Arctique'], 2),
  numeric('Combien d’os compte le squelette humain adulte ?', 206, 4),
  mcq('Qui a écrit « Les Misérables » ?', ['Zola', 'Hugo', 'Balzac', 'Flaubert'], 1),
  trueFalse('Le kangourou est un marsupial.', true),
  poll('Quel domaine vous plaît le plus ?', ['Les sciences', 'Les arts', 'L’histoire', 'Le sport']),
];

const QUIZZES: Array<{ title: string; description: string; questions: SeedQuestion[] }> = [
  { title: 'Culture générale', description: 'Le grand mélange, douze questions.', questions: CULTURE },
  { title: 'Histoire de France', description: 'Des Capétiens à la Ve République.', questions: HISTOIRE },
  { title: 'Géographie du monde', description: 'Fleuves, capitales et déserts.', questions: GEOGRAPHIE },
  { title: 'Sciences et nature', description: 'Chimie, biologie, astronomie.', questions: SCIENCES },
  { title: 'Cinéma des années 90', description: 'Une décennie en trois questions.', questions: CINEMA },
  { title: 'Nouveau quiz sans questions', description: 'Brouillon à compléter.', questions: [] },
];

const ROBOTS = ['Camille', 'Karim', 'Marie', 'Ana', 'Youssef', 'Léa', 'Tom', 'Inès'];

// --- Sockets ----------------------------------------------------------------------------

/** The shared driver's sockets, wired to the real API rather than to the mock. */
const connect = (namespace: string, options: Parameters<typeof connectTo>[1] = {}) =>
  connectTo(namespace, options, API_URL);

// --- Building the data set ---------------------------------------------------------------

interface SnapshotChoice {
  id: string;
  label: string;
  isCorrect: boolean;
}
interface SnapshotQuestion {
  id: string;
  type: string;
  choices: SnapshotChoice[];
  numericAnswer: { value: number } | null;
}

/** Starts from a clean database: without a purge, every run would stack a new data set. */
async function wipe(request: APIRequestContext): Promise<void> {
  const { sessions } = await api<{ sessions: Array<{ id: string }> }>(request, 'GET', '/sessions');
  for (const s of sessions) await api(request, 'DELETE', `/sessions/${s.id}`);
  const { quizzes } = await api<{ quizzes: Array<{ id: string }> }>(request, 'GET', '/quizzes');
  for (const q of quizzes) {
    await api(request, 'POST', `/quizzes/${q.id}/archive`);
    await api(request, 'DELETE', `/quizzes/${q.id}`);
  }
}

async function createQuiz(
  request: APIRequestContext,
  spec: { title: string; description: string; questions: SeedQuestion[] },
): Promise<string> {
  const { quiz } = await api<{ quiz: { id: string } }>(request, 'POST', '/quizzes', {
    title: spec.title,
    description: spec.description,
  });
  if (spec.questions.length > 0) {
    await api(request, 'PUT', `/quizzes/${quiz.id}/questions`, {
      // Business rules of `validateQuestionShape`: a speed bonus requires a time limit,
      // and a poll awards no points.
      questions: spec.questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        pointsCorrect: q.type === 'POLL' ? 0 : 100,
        pointsWrong: 0,
        timeLimitSec: 30,
        speedBonusMax: q.type === 'POLL' ? 0 : 50,
        choices: q.choices,
        numericAnswer: q.numericAnswer,
      })),
    });
  }
  return quiz.id;
}

/**
 * Admin accounts cannot be deleted (deactivation only): this function is therefore
 * idempotent — creation if absent, then `isActive` aligned on the wanted state.
 */
async function ensureAdmin(
  request: APIRequestContext,
  spec: { email: string; displayName: string; isActive: boolean },
): Promise<void> {
  const before = await api<{ admins: Array<{ id: string; email: string }> }>(request, 'GET', '/admins');
  if (!before.admins.some((a) => a.email === spec.email)) {
    await api(request, 'POST', '/admins', {
      email: spec.email,
      displayName: spec.displayName,
      password: 'demo-password-12',
    });
  }
  const after = await api<{ admins: Array<{ id: string; email: string; isActive: boolean }> }>(
    request,
    'GET',
    '/admins',
  );
  const admin = after.admins.find((a) => a.email === spec.email);
  if (admin && admin.isActive !== spec.isActive) {
    await api(request, 'PATCH', `/admins/${admin.id}`, { isActive: spec.isActive });
  }
}

async function openSession(
  request: APIRequestContext,
  quizId: string,
): Promise<{ sessionId: string; code: string }> {
  return api<{ sessionId: string; code: string }>(request, 'POST', `/quizzes/${quizId}/sessions`, {});
}

/** Brings bots into the room; returns their sockets for the rest of the game. */
async function joinRobots(code: string, names: string[]): Promise<Socket[]> {
  const sockets: Socket[] = [];
  for (const nickname of names) {
    const socket = await connect('/participant');
    const ack = await emitAck(socket, 'participant:join', { code, nickname });
    if (!ack.ok) throw new Error(`${nickname} n’a pas pu rejoindre : ${ack.code}`);
    sockets.push(socket);
  }
  return sockets;
}

/**
 * Plays a session from start to finish: open, bot answers, close, next question, then end of
 * session. The answers are deliberately uneven (the first bot answers correctly more often) so
 * that distributions, ranking and « plus rapide » have some relief.
 */
async function playSession(
  request: APIRequestContext,
  cookie: string,
  sessionId: string,
  code: string,
  robotNames: string[],
): Promise<void> {
  const robots = await joinRobots(code, robotNames);
  const presenter = await connect('/presenter', {
    auth: { sessionId },
    extraHeaders: { Cookie: cookie },
  });

  const { session } = await api<{ session: { quizSnapshot: { questions: SnapshotQuestion[] } } }>(
    request,
    'GET',
    `/sessions/${sessionId}`,
  );
  const questions = session.quizSnapshot.questions;

  const start = await emitAck(presenter, 'session:start', {});
  if (!start.ok) throw new Error(`session:start → ${start.code}`);

  for (let index = 0; index < questions.length; index += 1) {
    const q = questions[index]!;
    for (let r = 0; r < robots.length; r += 1) {
      // One bot in five abstains: the « n / m ont répondu » line must not be full.
      if ((index + r) % 5 === 4) continue;
      const correct = r % 3 !== 2; // two bots in three get it right
      let answer: { choiceId?: string; value?: string };
      if (q.type === 'NUMERIC') {
        const expected = q.numericAnswer?.value ?? 0;
        answer = { value: String(correct ? expected : expected + 5 + r) };
      } else {
        const wanted = q.choices.find((c) => c.isCorrect === correct) ?? q.choices[r % q.choices.length]!;
        answer = { choiceId: wanted.id };
      }
      // Spreads the answers over time BEFORE answering: `elapsedMs` starts at the opening of
      // the question, and without this wait « Plus rapide » would show 0 s.
      await new Promise((resolve) => setTimeout(resolve, r === 0 ? 700 : 450));
      const ack = await emitAck(robots[r]!, 'answer:submit', { questionIndex: index, answer });
      if (!ack.ok && ack.code !== 'ALREADY_ANSWERED') {
        throw new Error(`answer:submit (q${index}, robot ${r}) → ${ack.code}`);
      }
    }
    const closed = await emitAck(presenter, 'question:close', { expectedIndex: index });
    if (!closed.ok) throw new Error(`question:close (q${index}) → ${closed.code}`);
    const next = await emitAck(presenter, 'question:next', { expectedIndex: index });
    if (!next.ok) throw new Error(`question:next (q${index}) → ${next.code}`);
  }

  await emitAck(presenter, 'session:end', {});
  presenter.disconnect();
  for (const r of robots) r.disconnect();
}

// --- Screenshots -------------------------------------------------------------------------

async function capture(page: Page, name: string, viewport: ViewportName): Promise<void> {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350); // end of the qiRise entries (30 ms × 8 + 200 ms)
  await shot(page, LOT, `${name}-${viewport}`);
}

async function gotoAdmin(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'networkidle' });
  await expect(page.getByRole('tablist', { name: 'Navigation principale' })).toBeVisible();
}

// --- Spec --------------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Back-office — protocole visuel du lot 3', () => {
  let context: BrowserContext;
  let page: Page;
  let errors: string[];
  let liveCodes: string[] = [];
  let endedSessionId = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: VIEWPORTS['admin-1440'] });
    page = await context.newPage();
    errors = watchForErrors(page, [
      // The « login erreur » capture deliberately triggers a 401 on /auth/login.
      /Failed to load resource.*401/,
      /\/api\/v1\/auth\/(login|me)/,
    ]);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login — vide puis erreur', async () => {
    await page.goto('/admin/login', { waitUntil: 'networkidle' });
    await capture(page, 'login', 'admin-1440');

    await page.getByLabel('Adresse e-mail').fill('admin@example.fr');
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await capture(page, 'login-erreur', 'admin-1440');
  });

  test('mes quiz — état vide', async () => {
    await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL);
    await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await wipe(page.request);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Aucun quiz pour l’instant')).toBeVisible();
    await capture(page, 'mes-quiz-vide', 'admin-1440');
  });

  test('jeu de démonstration', async () => {
    const cookies = await context.cookies();
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const ids: string[] = [];
    for (const spec of QUIZZES) ids.push(await createQuiz(page.request, spec));

    // Two sessions played through to the end — « Détail de session » needs real answers.
    const histoire = await openSession(page.request, ids[1]!);
    await playSession(page.request, cookie, histoire.sessionId, histoire.code, ROBOTS.slice(0, 6));
    endedSessionId = histoire.sessionId;

    const sciences = await openSession(page.request, ids[3]!);
    await playSession(page.request, cookie, sciences.sessionId, sciences.code, ROBOTS.slice(0, 4));

    // Two open sessions, left in the lobby, with participants present.
    const geo = await openSession(page.request, ids[2]!);
    await joinRobots(geo.code, ROBOTS.slice(0, 5));
    const culture = await openSession(page.request, ids[0]!);
    await joinRobots(culture.code, ROBOTS.slice(0, 3));
    liveCodes = [geo.code, culture.code];
    expect(liveCodes).toHaveLength(2);

    // One active account and one deactivated: « Comptes » must show the `Badge danger`.
    await ensureAdmin(page.request, {
      email: 'claire.dupont@example.fr',
      displayName: 'Claire Dupont',
      isActive: true,
    });
    await ensureAdmin(page.request, {
      email: 'marc.olivier@example.fr',
      displayName: 'Marc Olivier',
      isActive: false,
    });
  });

  test('mes quiz — 6 cartes et 2 sessions en direct', async () => {
    await gotoAdmin(page, '/admin');
    await expect(page.getByText('En direct')).toBeVisible();
    for (const viewport of ['admin-1440', 'admin-1280', 'admin-1024'] as ViewportName[]) {
      await capture(page, 'mes-quiz', viewport);
    }
  });

  test('sessions — les deux onglets', async () => {
    await gotoAdmin(page, '/admin/sessions');
    await capture(page, 'sessions-en-cours', 'admin-1440');
    await page.getByRole('tab', { name: /Terminées/ }).click();
    await capture(page, 'sessions-terminees', 'admin-1440');
  });

  test('détail de session', async () => {
    await gotoAdmin(page, `/admin/sessions/${endedSessionId}`);
    await expect(page.getByText('Classement')).toBeVisible();
    for (const viewport of ['admin-1440', 'admin-1280', 'admin-1024'] as ViewportName[]) {
      await capture(page, 'detail-session', viewport);
    }
  });

  test('comptes — liste et dialog de désactivation', async () => {
    await gotoAdmin(page, '/admin/admins');
    await expect(page.getByText('Créer un compte')).toBeVisible();
    await capture(page, 'comptes', 'admin-1440');

    await page.getByRole('button', { name: 'Désactiver' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, 'comptes-dialog-desactivation', 'admin-1440');
    await page.getByRole('button', { name: 'Annuler' }).click();

    expect(errors, 'erreurs console pendant le parcours admin').toEqual([]);
  });
});
