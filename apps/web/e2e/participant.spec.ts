// Lot 1 — Participant: visual protocol § 11 (matrix § 11.3, viewports § 11.2).
//
// Prerequisites: `pnpm mock:live` (:4001) and `MOCK=1 pnpm --filter @quiz/web dev` (:5173).
// A « presenter driver » (socket.io-client on /presenter) and bot participants
// (/participant sockets) step the mock through its phases; the hero's page is captured at
// each state into docs/screens/participant/<state>-<viewport>.png.

import { expect, test, type Page } from '@playwright/test';

import { escapeRe, settle, shot, VIEWPORTS, watchForErrors, type ViewportName } from './helpers';
import { Bot, createSession, mockJson, Presenter, type MockQuestion } from './mock-driver';

const LOT = 'participant';

// --- Hero (Playwright page) ---------------------------------------------------------------

/** Nickname of the participant followed by the Playwright page, from one end of the journey to the other. */
const HERO = 'Camille';

const P390: ViewportName = 'participant-390';
const ALL: ViewportName[] = ['participant-390', 'participant-360', 'participant-430'];

async function capture(page: Page, name: string, viewports: ViewportName[] = [P390]): Promise<void> {
  for (const vp of viewports) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await page.waitForTimeout(150);
    await shot(page, LOT, `${name}-${vp.replace('participant-', '')}`);
  }
  await page.setViewportSize(VIEWPORTS[P390]);
}

async function heroJoin(page: Page, nickname: string): Promise<void> {
  await page.getByLabel('Votre pseudonyme').fill(nickname);
  await page.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(page.getByRole('heading', { name: 'Vous êtes dans la salle' })).toBeVisible();
}

async function waitQuestion(page: Page, q: MockQuestion): Promise<void> {
  await expect(page.getByRole('heading', { name: q.prompt })).toBeVisible({ timeout: 10_000 });
}

async function waitResult(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 10_000 });
}

async function heroPick(page: Page, q: MockQuestion, which: 'correct' | 'wrong'): Promise<void> {
  const choice = q.choices.find((c) => (which === 'correct' ? c.isCorrect : !c.isCorrect));
  if (!choice) throw new Error('no choice');
  await page.getByRole('button', { name: new RegExp(`^Choix [A-F] : ${escapeRe(choice.label)}$`) }).click();
}

const EXPECTED_404 = [
  /Failed to load resource.*(404|410)/,
  /the server responded with a status of (404|410)/,
];

// --- Scenario A: three participants, the hero finishes 1st ----------------------------------

test.describe.serial('lot 1 — participant', () => {
  test.setTimeout(180_000);

  test('parcours complet, rang 1 (code → pseudo → attente → questions → retours → classement → fin)', async ({
    page,
  }) => {
    const errors = watchForErrors(page, EXPECTED_404);
    const session = await createSession('showcase');
    const Q = session.quiz.questions;
    const presenter = await Presenter.attach(session.id);
    const nour = await Bot.join(session.code, 'Nour', 'wrong');
    const theo = await Bot.join(session.code, 'Théo', 'silent');
    const bots = [nour, theo];

    await page.setViewportSize(VIEWPORTS[P390]);

    // Code
    await page.goto('/');
    await settle(page, 300);
    await capture(page, 'code-vide');
    await page.getByLabel('Code de session').fill(session.code);
    await capture(page, 'code-saisi');
    await page.getByRole('button', { name: 'Rejoindre' }).click();
    await page.waitForURL(`**/j/${session.code}`);

    // Nickname
    await expect(page.getByText('personnes déjà dans la salle')).toBeVisible();
    await settle(page, 300);
    await capture(page, 'pseudo-vide');
    await page.getByLabel('Votre pseudonyme').fill('Nour');
    await page.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await capture(page, 'pseudo-erreur-deja-pris');

    // Lobby
    await heroJoin(page, HERO);
    await settle(page);
    await capture(page, 'attente');

    // Q1 — 4-choice MCQ: selection in progress (delayed ack), answer recorded, correct feedback.
    await presenter.start();
    await waitQuestion(page, Q[0]!);
    await settle(page, 400);
    await capture(page, 'question-qcm-4');
    await mockJson(`/mock/sessions/${session.id}/ack-delay`, {
      method: 'POST',
      body: JSON.stringify({ ms: 3000 }),
    });
    await heroPick(page, Q[0]!, 'correct');
    await page.waitForTimeout(250);
    await capture(page, 'selection-en-cours');
    await expect(page.getByText('Réponse enregistrée')).toBeVisible({ timeout: 10_000 });
    await settle(page, 300);
    await capture(page, 'reponse-enregistree');
    await mockJson(`/mock/sessions/${session.id}/ack-delay`, {
      method: 'POST',
      body: JSON.stringify({ ms: 0 }),
    });
    for (const b of bots) await b.answer(0, Q[0]!);
    await presenter.close(0);
    await waitResult(page, 'Bonne réponse');
    await settle(page);
    await capture(page, 'retour-juste');

    // Q2 — 6-choice MCQ + image, long prompt: wrong feedback (negative points).
    await presenter.next(0);
    await waitQuestion(page, Q[1]!);
    await settle(page, 600);
    await capture(page, 'question-qcm-6-image', ALL);
    await heroPick(page, Q[1]!, 'wrong');
    await expect(page.getByText('Réponse enregistrée')).toBeVisible();
    for (const b of bots) await b.answer(1, Q[1]!);
    await presenter.close(1);
    await waitResult(page, 'Raté');
    await settle(page);
    await capture(page, 'retour-faux');

    // Q3 — true/false: no answer.
    await presenter.next(1);
    await waitQuestion(page, Q[2]!);
    await settle(page, 400);
    await capture(page, 'question-vrai-faux');
    await presenter.close(2);
    await waitResult(page, 'Pas de réponse');
    await settle(page);
    await capture(page, 'sans-reponse');

    // Q4 — numeric.
    await presenter.next(2);
    await waitQuestion(page, Q[3]!);
    await settle(page, 400);
    await capture(page, 'question-numerique');
    await page.getByLabel('Votre réponse numérique').fill(String(Q[3]!.numericAnswer!.value));
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('Réponse enregistrée')).toBeVisible();
    await capture(page, 'question-numerique-enregistree');
    await presenter.close(3);
    await waitResult(page, 'Bonne réponse');
    await settle(page);
    await capture(page, 'retour-juste-numerique');

    // Q5 — poll.
    await presenter.next(3);
    await waitQuestion(page, Q[4]!);
    await settle(page, 400);
    await capture(page, 'question-sondage');
    await heroPick(page, Q[4]!, 'wrong');
    await expect(page.getByText('Réponse enregistrée')).toBeVisible();
    for (const b of bots) await b.answer(4, Q[4]!);
    await presenter.close(4);
    await waitResult(page, 'Merci pour votre avis');
    await settle(page);
    await capture(page, 'retour-sondage');

    // Q6 — hidden media.
    await presenter.next(4);
    await waitQuestion(page, Q[5]!);
    await settle(page, 400);
    await capture(page, 'question-media-cache');
    await presenter.close(5);
    await waitResult(page, 'Pas de réponse');

    // Final ranking — rank 1.
    await presenter.next(5);
    await expect(page.getByRole('heading', { name: 'Podium' })).toBeVisible({ timeout: 10_000 });
    await settle(page, 1400);
    await capture(page, 'classement-rang-1', ALL);

    // Reconnection: server-side cut, the pill drops from the top.
    await mockJson(`/mock/sessions/${session.id}/disconnect`, { method: 'POST' });
    await expect(page.getByRole('alert')).toHaveText('Reconnexion…');
    await settle(page, 400);
    await capture(page, 'reconnexion');

    // Ended: the session is closed, the route answers 410.
    await presenter.end();
    await page.goto(`/j/${session.code}`);
    await expect(page.getByRole('heading', { name: 'La session est terminée' })).toBeVisible();
    await settle(page, 300);
    await capture(page, 'terminee');

    // Not found.
    await page.goto('/j/ZZZZZZ');
    await expect(page.getByRole('heading', { name: 'Aucune session avec ce code' })).toBeVisible();
    await settle(page, 300);
    await capture(page, 'introuvable');

    presenter.dispose();
    for (const b of bots) b.dispose();
    expect(errors, 'erreurs console (scénario A)').toEqual([]);
  });

  // --- Scenario B: 24 participants, the hero finishes 7th, then is kicked ----------------------

  test('salle de 24, rang 7, retiré', async ({ page }) => {
    const errors = watchForErrors(page, EXPECTED_404);
    const session = await createSession('showcase');
    const Q = session.quiz.questions;
    const presenter = await Presenter.attach(session.id);
    const names = [
      'Alexandre-Benjamin K',
      'Inès',
      'Théo',
      'Nour',
      'Louise',
      'Yanis',
      'Marie',
      'Karim',
      'Éric',
      'Sofia',
      'Hugo',
      'Léa',
      'Adam',
      'Chloé',
      'Nathan',
      'Emma',
      'Lucas',
      'Jade',
      'Gabriel',
      'Manon',
      'Rayan',
      'Zoé',
      'Mohamed',
    ];
    const bots: Bot[] = [];
    for (const [i, name] of names.entries()) {
      bots.push(await Bot.join(session.code, name, i < 6 ? 'correct' : 'silent'));
    }

    await page.setViewportSize(VIEWPORTS[P390]);
    await page.goto('/');
    await page.getByLabel('Code de session').fill(session.code);
    await capture(page, 'code-saisi', ['participant-360', 'participant-430']);
    await page.getByRole('button', { name: 'Rejoindre' }).click();
    await page.waitForURL(`**/j/${session.code}`);
    await expect(page.getByText('personnes déjà dans la salle')).toBeVisible();
    await settle(page, 300);
    await capture(page, 'pseudo-vide-24');
    await heroJoin(page, HERO);
    await settle(page);
    await capture(page, 'attente-24');

    // Q1: the hero answers correctly; so do the six strong bots.
    await presenter.start();
    await waitQuestion(page, Q[0]!);
    await heroPick(page, Q[0]!, 'correct');
    await expect(page.getByText('Réponse enregistrée')).toBeVisible();
    for (const b of bots) await b.answer(0, Q[0]!);
    await presenter.close(0);
    await waitResult(page, 'Bonne réponse');
    await settle(page);
    await capture(page, 'retour-juste-24');

    // Q2: the hero gets it wrong → « Raté », − 25, rank 7 / 24.
    await presenter.next(0);
    await waitQuestion(page, Q[1]!);
    await heroPick(page, Q[1]!, 'wrong');
    await expect(page.getByText('Réponse enregistrée')).toBeVisible();
    for (const b of bots) await b.answer(1, Q[1]!);
    await presenter.close(1);
    await waitResult(page, 'Raté');
    await settle(page);
    await capture(page, 'retour-faux', ['participant-360', 'participant-430']);

    // Q3 → Q6 without capture; the hero no longer answers.
    for (let i = 2; i < Q.length; i += 1) {
      await presenter.next(i - 1);
      await waitQuestion(page, Q[i]!);
      for (const b of bots) await b.answer(i, Q[i]!);
      await presenter.close(i);
      await expect(page.getByRole('heading', { name: /Pas de réponse|Merci pour votre avis/ })).toBeVisible({
        timeout: 10_000,
      });
    }

    // Final ranking — rank 7 / 24.
    await presenter.next(Q.length - 1);
    await expect(page.getByRole('heading', { name: 'Podium' })).toBeVisible({ timeout: 10_000 });
    await settle(page, 1400);
    await capture(page, 'classement-rang-7', ALL);

    // Kicked by the presenter.
    const detail = await mockJson<{ participants: Array<{ id: string; nickname: string }> }>(
      `/mock/sessions/${session.id}`,
    );
    const hero = detail.participants.find((p) => p.nickname === HERO);
    if (!hero) throw new Error('hero not found');
    await presenter.kick(hero.id);
    await expect(page.getByRole('heading', { name: 'Vous avez été retiré de la session' })).toBeVisible();
    await settle(page, 300);
    await capture(page, 'retire');

    presenter.dispose();
    for (const b of bots) b.dispose();
    expect(errors, 'erreurs console (scénario B)').toEqual([]);
  });
});
