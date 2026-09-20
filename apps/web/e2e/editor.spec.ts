// Lot 4 — Editor: functional proofs + visual protocol § 11 (matrix § 11.3, viewports § 11.2).
//
// Prerequisite: the real API and the database seeded by `admin.spec.ts` (quiz « Histoire de France »
// played, hence locked). This spec adds its own ten-question quiz, recreated on every run
// (idempotent):
//
//   pnpm --filter @quiz/api dev                       # API :3000
//   pnpm --filter @quiz/web dev                       # web :5173, proxies /api to :3000
//   E2E_BASE_URL=http://localhost:5173 pnpm --filter @quiz/web exec playwright test e2e/editor.spec.ts
//
// Proven scenarios: create → edit → reorder (mouse and keyboard) → delete → save
// (Ctrl+S) → reload (local draft restored) → locked quiz (inert fields, refused PUT
// rendered cleanly) → duplicate → launch.

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import path from 'node:path';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  api,
  SCREENS_DIR,
  shot,
  VIEWPORTS,
  watchForErrors,
  type ViewportName,
} from './helpers';

const LOT = 'editor';
const TITLE_TEN = 'Lot 4 — Dix questions';
const TITLE_NEW = 'Lot 4 — Quiz créé par le spec';

// --- Data set ------------------------------------------------------------------------------

interface SeedChoice {
  label: string;
  isCorrect: boolean;
}
interface SeedQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'NUMERIC' | 'POLL';
  prompt: string;
  choices: SeedChoice[];
  numericAnswer: { value: number; tolerance: number; toleranceMode: 'ABSOLUTE' | 'PERCENT' } | null;
  timeLimitSec: number | null;
  speedBonusMax: number;
}

function mcq(prompt: string, labels: string[], correct: number, time: number | null = 30): SeedQuestion {
  return {
    type: 'MCQ',
    prompt,
    choices: labels.map((label, i) => ({ label, isCorrect: i === correct })),
    numericAnswer: null,
    timeLimitSec: time,
    speedBonusMax: time ? 50 : 0,
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
    timeLimitSec: 20,
    speedBonusMax: 0,
  };
}
function numeric(
  prompt: string,
  value: number,
  tolerance: number,
  toleranceMode: 'ABSOLUTE' | 'PERCENT' = 'ABSOLUTE',
): SeedQuestion {
  return {
    type: 'NUMERIC',
    prompt,
    choices: [],
    numericAnswer: { value, tolerance, toleranceMode },
    timeLimitSec: 45,
    speedBonusMax: 20,
  };
}
function poll(prompt: string, labels: string[]): SeedQuestion {
  return {
    type: 'POLL',
    prompt,
    choices: labels.map((label) => ({ label, isCorrect: false })),
    numericAnswer: null,
    timeLimitSec: null,
    speedBonusMax: 0,
  };
}

/** Edge cases § 11.4-8: a 500-character prompt, six 80-character propositions. */
const LONG_PROMPT = (
  'Dans le cadre de la refonte du système d’information, quelle mesure organisationnelle permet ' +
  'le mieux de garantir la continuité de service pendant la bascule, sachant que les équipes ' +
  'métier ne peuvent pas interrompre leur activité plus de deux heures consécutives, que le ' +
  'prestataire d’hébergement impose une fenêtre de maintenance nocturne et que la direction ' +
  'souhaite conserver une possibilité de retour arrière complet pendant au moins une semaine ' +
  'après la mise en production, sans surcoût de licence supplémentaire ni recrutement ?'
).slice(0, 500);

const LONG_CHOICE = (n: number) =>
  `Proposition ${n} — un libellé volontairement long pour vérifier le retour à la ligne des cases`.slice(
    0,
    80,
  );

const TEN: SeedQuestion[] = [
  mcq('Quel format de fichier est colonnaire ?', ['CSV', 'Parquet', 'JSON', 'Avro'], 1),
  mcq(LONG_PROMPT, [1, 2, 3, 4, 5, 6].map(LONG_CHOICE), 2),
  trueFalse('Le mont Blanc culmine à plus de 4 800 mètres.', true),
  numeric('En quelle année la tour Eiffel a-t-elle été inaugurée ?', 1889, 2),
  poll('Quel domaine vous plaît le plus ?', ['Les sciences', 'Les arts', 'L’histoire', 'Le sport']),
  mcq('Qui a peint « La Nuit étoilée » ?', ['Monet', 'Van Gogh', 'Cézanne', 'Gauguin'], 1, null),
  numeric('Quelle est la vitesse de la lumière dans le vide, en km/s ?', 299_792, 1, 'PERCENT'),
  trueFalse('Une année bissextile compte 366 jours.', true),
  mcq('Quel est le plus grand océan ?', ['L’Atlantique', 'L’Indien', 'Le Pacifique', 'L’Arctique'], 2),
  mcq('Qui a écrit « Les Misérables » ?', ['Zola', 'Hugo', 'Balzac', 'Flaubert'], 1),
];

// --- REST -----------------------------------------------------------------------------------

interface QuizRow {
  id: string;
  title: string;
  questionCount: number;
  sessionCount: number;
}

async function listQuizzes(request: APIRequestContext): Promise<QuizRow[]> {
  return (await api<{ quizzes: QuizRow[] }>(request, 'GET', '/quizzes')).quizzes;
}

/** Recreates the ten-question quiz of lot 4 (and purges the copies left by a previous run). */
async function resetTenQuestionQuiz(request: APIRequestContext): Promise<string> {
  // The copy launched at the end of the previous spec has a session: it goes before its quiz.
  const { sessions } = await api<{ sessions: Array<{ id: string; quizTitle: string }> }>(
    request,
    'GET',
    '/sessions',
  );
  for (const s of sessions) {
    if (s.quizTitle.startsWith('Lot 4')) await api(request, 'DELETE', `/sessions/${s.id}`);
  }
  for (const q of await listQuizzes(request)) {
    if (q.title.startsWith('Lot 4')) {
      await api(request, 'POST', `/quizzes/${q.id}/archive`);
      await api(request, 'DELETE', `/quizzes/${q.id}`);
    }
  }
  const { quiz } = await api<{ quiz: { id: string } }>(request, 'POST', '/quizzes', {
    title: TITLE_TEN,
    description: 'Dix questions de tous types, un énoncé de 500 caractères, six propositions de 80.',
  });
  await api(request, 'PUT', `/quizzes/${quiz.id}/questions`, {
    questions: TEN.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      pointsCorrect: q.type === 'POLL' ? 0 : 100,
      pointsWrong: q.type === 'POLL' ? 0 : -25,
      timeLimitSec: q.timeLimitSec,
      speedBonusMax: q.speedBonusMax,
      choices: q.choices,
      numericAnswer: q.numericAnswer,
    })),
  });
  return quiz.id;
}

// --- UI helpers -------------------------------------------------------------------------------

async function capture(page: Page, name: string, viewport: ViewportName): Promise<void> {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.evaluate(() => document.fonts.ready);
  // Full page from the top: scrolled, the sticky bars would end up in the middle of the image.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400); // end of the qiRise entries (30 ms × 8 + 200 ms)
  await shot(page, LOT, `${name}-${viewport}`);
}

async function openEditor(page: Page, quizId: string): Promise<void> {
  await page.goto(`/admin/quizzes/${quizId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('region', { name: 'Questions' })).toBeVisible();
}

/** Prompts of the left-hand list, in display order. */
async function listedPrompts(page: Page): Promise<string[]> {
  const buttons = page
    .getByRole('region', { name: 'Questions' })
    .getByRole('button', { name: /^Question \d+ sur/ });
  const names = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  // `\s` covers the separator's non-breaking space (raw `aria-label`, not normalised by Playwright).
  return names.map((n) => n.replace(/^Question \d+ sur \d+\s:\s/, ''));
}

function questionButton(page: Page, index: number): Locator {
  return page
    .getByRole('region', { name: 'Questions' })
    .getByRole('button', { name: new RegExp(`^Question ${index} sur`) });
}

async function selectQuestion(page: Page, index: number): Promise<void> {
  await questionButton(page, index).click();
  await expect(questionButton(page, index)).toHaveAttribute('aria-pressed', 'true');
}

// --- Spec ---------------------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Éditeur — lot 4', () => {
  let context: BrowserContext;
  let page: Page;
  let errors: string[];
  let tenId = '';
  let lockedId = '';
  let copyId = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: VIEWPORTS['admin-1440'] });
    page = await context.newPage();
    errors = watchForErrors(page, [
      // The refused PUT (QUIZ_LOCKED) is triggered deliberately: the browser logs the 409.
      /Failed to load resource.*409/,
    ]);

    await page.goto('/admin/login', { waitUntil: 'networkidle' });
    await page.getByLabel('Adresse e-mail').fill(ADMIN_EMAIL);
    await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    tenId = await resetTenQuestionQuiz(page.request);
    const locked = (await listQuizzes(page.request)).find(
      (q) => q.title === 'Histoire de France' && q.sessionCount > 0,
    );
    if (!locked)
      throw new Error('Lancez d’abord admin.spec.ts : « Histoire de France » doit avoir une session jouée.');
    lockedId = locked.id;
  });

  test.afterAll(async () => {
    await context.close();
  });

  // --- Create ------------------------------------------------------------------------------------

  test('éditeur nouveau — capture, puis création par Ctrl+S', async () => {
    await page.evaluate(() => localStorage.removeItem('quiz:draft:new'));
    await page.goto('/admin/quizzes/new', { waitUntil: 'networkidle' });
    await expect(page.getByText('Aucune question pour l’instant')).toBeVisible();
    await expect(page.getByText('Nouveau', { exact: true })).toBeVisible();
    await capture(page, 'editeur-nouveau', 'admin-1440');

    await page.getByLabel('Titre du quiz').fill(TITLE_NEW);
    await page.getByRole('button', { name: 'Ajouter une question' }).last().click();
    await page.getByRole('textbox', { name: 'Énoncé' }).fill('Quelle est la capitale de la Norvège ?');
    await page.getByLabel('Proposition A', { exact: true }).fill('Oslo');
    await page.getByLabel('Proposition B', { exact: true }).fill('Bergen');
    await expect(page.getByText('Non enregistré')).toBeVisible();

    await page.keyboard.press('Control+s');
    await expect(page).toHaveURL(/\/admin\/quizzes\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();

    const created = (await listQuizzes(page.request)).find((q) => q.title === TITLE_NEW);
    expect(created?.questionCount).toBe(1);
  });

  // --- Ten questions: screenshots --------------------------------------------------------------------

  test('éditeur 10 questions — QCM sélectionnée, trois viewports', async () => {
    await openEditor(page, tenId);
    await selectQuestion(page, 2); // six 80-character propositions, 500-character prompt
    for (const viewport of ['admin-1440', 'admin-1280', 'admin-1024'] as ViewportName[]) {
      await capture(page, 'editeur-10-questions', viewport);
    }
    await page.setViewportSize(VIEWPORTS['admin-1440']);
  });

  test('éditeur numérique et vrai/faux', async () => {
    await selectQuestion(page, 7);
    await expect(page.getByRole('tab', { name: 'Numérique' })).toHaveAttribute('aria-selected', 'true');
    await capture(page, 'editeur-numerique', 'admin-1440');

    await selectQuestion(page, 3);
    await expect(page.getByRole('tab', { name: 'Vrai ou faux' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Vrai$/ })).toHaveAttribute('aria-pressed', 'true');
    await capture(page, 'editeur-vrai-faux', 'admin-1440');
  });

  test('aperçu téléphone — trois viewports', async () => {
    await selectQuestion(page, 2);
    await page.getByRole('tab', { name: 'Aperçu' }).click();
    await expect(page.getByRole('img', { name: 'Aperçu participant' })).toBeVisible();
    for (const viewport of ['admin-1440', 'admin-1280', 'admin-1024'] as ViewportName[]) {
      await capture(page, 'apercu-telephone', viewport);
    }
    await page.setViewportSize(VIEWPORTS['admin-1440']);
    await page.getByRole('tab', { name: 'Réglages' }).click();
  });

  // --- Reorder ----------------------------------------------------------------------------------------

  test('réordonner à la souris — capture pendant le glisser', async () => {
    const before = await listedPrompts(page);
    const handle = page.getByRole('button', { name: 'Déplacer la question 1', exact: true });
    const target = page.getByRole('button', { name: 'Déplacer la question 3', exact: true });
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error('poignées introuvables');

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, { steps: 12 });
    await page.waitForTimeout(250);
    // Viewport-only capture: a full-page capture resizes the window mid-drag,
    // which makes the pointer sensor lose its target.
    await page.screenshot({ path: path.join(SCREENS_DIR, LOT, 'glisser-en-cours-admin-1440.png') });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await listedPrompts(page);
    expect(after[0]).toBe(before[1]);
    expect(after[2]).toBe(before[0]);
    await expect(page.getByText('Non enregistré')).toBeVisible();
  });

  test('réordonner au clavier — Espace, flèche, Espace, annonce', async () => {
    const before = await listedPrompts(page);
    const handle = page.getByRole('button', { name: 'Déplacer la question 1', exact: true });
    await handle.focus();
    await page.keyboard.press('Space');
    // The grab is announced, then immediately the initial position (`onDragOver` on itself). The
    // dnd-kit keyboard sensor attaches its `keydown` listener on the next tick (setTimeout).
    await expect(page.getByText(/Question 1 (saisie|en position 1)/)).toBeAttached();
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByText(/Question 1 en position 2/)).toBeAttached();
    await page.keyboard.press('Space');
    await expect(page.getByText(/Question déposée en position 2/)).toBeAttached();
    await page.waitForTimeout(300);

    const after = await listedPrompts(page);
    expect(after[1]).toBe(before[0]);
    expect(after[0]).toBe(before[1]);
    await capture(page, 'reordonnancement-clavier', 'admin-1440');

    // Accessible fallback: the « Monter » arrow of the selected question.
    await selectQuestion(page, 2);
    await page.getByRole('button', { name: 'Monter la question' }).click();
    expect((await listedPrompts(page))[0]).toBe(after[1]);
  });

  // --- Order draft, delete, save, reload -----------------------------------------------------------

  test('brouillon local — l’ordre réordonné survit au rechargement, puis Ctrl+S le persiste', async () => {
    const reordered = await listedPrompts(page);
    expect(reordered).not.toEqual(TEN.map((q) => q.prompt));
    await page.waitForTimeout(150);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(/Brouillon local restauré/)).toBeVisible();
    expect(await listedPrompts(page)).toEqual(reordered);

    // Two persisted questions swap places: the PUT parks the positions before rewriting
    // them (unique index (quizId, position)), the order is saved as is.
    await page.keyboard.press('Control+s');
    await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
    await expect(page.getByText(/Brouillon local restauré/)).toBeHidden();

    await page.reload({ waitUntil: 'networkidle' });
    expect(await listedPrompts(page)).toEqual(reordered);
    await expect(page.getByText(/Brouillon local restauré/)).toHaveCount(0);
  });

  test('supprimer — dialog, puis Ctrl+S et rechargement', async () => {
    const before = await listedPrompts(page);
    await selectQuestion(page, 10);
    await page.getByRole('button', { name: 'Supprimer la question 10', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Supprimer cette question ?' })).toBeVisible();
    await capture(page, 'dialog-suppression', 'admin-1440');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await listedPrompts(page)).toHaveLength(10);

    await page.getByRole('button', { name: 'Supprimer la question 10', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    expect(await listedPrompts(page)).toHaveLength(9);

    await page.keyboard.press('Control+s');
    await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    const after = await listedPrompts(page);
    expect(after).toHaveLength(9);
    expect(after).not.toContain(before[9]);
    expect(after).toEqual(before.slice(0, 9));
  });

  test('brouillon local — restauré au rechargement si non enregistré', async () => {
    await selectQuestion(page, 1);
    await page.getByRole('textbox', { name: 'Énoncé' }).fill('Énoncé modifié sans enregistrer');
    await expect(page.getByText('Non enregistré')).toBeVisible();
    await page.waitForTimeout(150);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(/Brouillon local restauré/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Énoncé' })).toHaveValue(
      'Énoncé modifié sans enregistrer',
    );
    await expect(page.getByText('Non enregistré')).toBeVisible();

    await page.getByRole('button', { name: 'Revenir à la version enregistrée' }).click();
    await expect(page.getByText(/Brouillon local restauré/)).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Énoncé' })).not.toHaveValue(
      'Énoncé modifié sans enregistrer',
    );
    await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
  });

  // --- Validation ----------------------------------------------------------------------------------------

  test('erreurs de validation — question vide, enregistrement refusé côté client', async () => {
    await page.getByRole('button', { name: 'Ajouter une question' }).last().click();
    await page.getByRole('textbox', { name: 'Énoncé' }).fill('Une question incomplète');
    await page.getByRole('textbox', { name: 'Énoncé' }).fill('');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Corrigez les questions' })).toBeVisible();
    await expect(page.getByText('L’énoncé est requis.')).toBeVisible();
    await expect(page.getByText('Chaque proposition doit avoir un libellé.')).toBeVisible();
    await expect(page.getByText('À corriger')).toBeVisible();
    await capture(page, 'editeur-erreurs-validation', 'admin-1440');

    // Fallback: remove the invalid question to leave the quiz clean.
    await page.getByRole('button', { name: 'Supprimer la question 10', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByText('À corriger')).toBeHidden();
  });

  // --- Locked --------------------------------------------------------------------------------------------

  test('quiz verrouillé — champs inertes, PUT refusé rendu proprement', async () => {
    await openEditor(page, lockedId);
    await expect(page.getByText('Verrouillé', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Ce quiz a déjà été joué' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'QCM' })).toBeDisabled();
    await expect(page.getByLabel('Proposition A', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Bonne réponse', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Déplacer la question 1', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Supprimer la question 1', exact: true })).toHaveCount(0);
    // The prompt, on the other hand, stays editable.
    await expect(page.getByRole('textbox', { name: 'Énoncé' })).toBeEnabled();
    await capture(page, 'editeur-verrouille', 'admin-1440');

    // The server refuses a PUT touching a played question: force the 409 QUIZ_LOCKED response
    // that the UI already blocks upstream, to check its rendering (alert + flagged question).
    const firstQuestionId = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/quizzes/${id}`, { credentials: 'same-origin' });
      const body = (await res.json()) as { quiz: { questions: Array<{ id: string }> } };
      return body.quiz.questions[0]?.id ?? '';
    }, lockedId);
    await page.route(`**/api/v1/quizzes/${lockedId}/questions`, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'QUIZ_LOCKED',
            message: 'Ce quiz a déjà été joué : dupliquez-le pour le modifier librement',
            details: { questionId: firstQuestionId, reason: 'scoring changed' },
          },
        }),
      }),
    );
    await selectQuestion(page, 2);
    await page.getByRole('textbox', { name: 'Énoncé' }).fill('Énoncé corrigé sur un quiz joué');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'dupliquez-le' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('barème d’une question déjà jouée');
    await expect(questionButton(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await page.unroute(`**/api/v1/quizzes/${lockedId}/questions`);
    await page.evaluate((id) => localStorage.removeItem(`quiz:draft:${id}`), lockedId);
  });

  // --- Duplicate, launch ----------------------------------------------------------------------------------

  test('dupliquer — la copie est libre', async () => {
    await openEditor(page, lockedId);
    await page.getByRole('button', { name: 'Dupliquer', exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(lockedId));
    await expect(page).toHaveURL(/\/admin\/quizzes\/[0-9a-f-]{36}$/);
    copyId = page.url().split('/').pop() ?? '';
    await expect(page.getByLabel('Titre du quiz')).toHaveValue(/\(copie\)$/);
    await expect(page.getByText('Verrouillé', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'QCM' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Déplacer la question 1', exact: true })).toBeEnabled();
  });

  test('lancer la session — enregistre puis ouvre l’écran présentateur', async () => {
    await page.getByLabel('Titre du quiz').fill('Lot 4 — Copie lancée');
    await page.getByRole('button', { name: 'Lancer la session' }).click();
    await expect(page).toHaveURL(/\/present\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    const copy = (await listQuizzes(page.request)).find((q) => q.id === copyId);
    expect(copy?.title).toBe('Lot 4 — Copie lancée'); // saved before the launch
    expect(copy?.sessionCount).toBe(1);

    expect(errors, 'erreurs console pendant le parcours éditeur').toEqual([]);
  });
});
