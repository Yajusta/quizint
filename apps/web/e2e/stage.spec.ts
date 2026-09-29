// Lot 2 — Stage: visual protocol § 11 (matrix § 11.3, viewports § 11.2).
//
// Prerequisites: `pnpm mock:live` (:4001) and `MOCK=1 pnpm --filter @quiz/web dev` (:5173).
// The Playwright page is the projected screen (/present/:sessionId). A « driver » (socket.io-client on
// /presenter, same room as the page) and bot participants (/participant sockets) step the mock
// through its phases; each state is captured into docs/screens/stage/<state>-<viewport>.png.

import { expect, test, type Page } from '@playwright/test';

import {
  MOCK_EXPECTED_ERRORS as EXPECTED_ERRORS,
  settle,
  shot,
  VIEWPORTS,
  watchForErrors,
  type ViewportName,
} from './helpers';
import { Bot, createSession, mockJson, Presenter as Pilot, type MockQuestion } from './mock-driver';

const LOT = 'stage';

// --- Projected screen (Playwright page) ---------------------------------------------------------

const S1920: ViewportName = 'stage-1920';
const KEY_VIEWPORTS: ViewportName[] = ['stage-1920', 'stage-1280', 'stage-1366'];

async function capture(page: Page, name: string, viewports: ViewportName[] = [S1920]): Promise<void> {
  for (const vp of viewports) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await page.waitForTimeout(250);
    await shot(page, LOT, `${name}-${vp.replace('stage-', '')}`);
  }
  await page.setViewportSize(VIEWPORTS[S1920]);
}

function waitQuestion(page: Page, q: MockQuestion): Promise<void> {
  return expect(page.getByRole('heading', { name: q.prompt })).toBeVisible({ timeout: 10_000 });
}

function waitClosed(page: Page): Promise<void> {
  return expect(page.getByRole('list', { name: 'Répartition des réponses' })).toBeVisible({
    timeout: 10_000,
  });
}

const NAMES_30 = [
  'Camille',
  'Théo',
  'Nour',
  'Alexandre-Benjamin K',
  'Inès',
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
  'Anaïs',
  'Baptiste',
  'Clémence',
  'Diego',
  'Elsa',
  'Farid',
];

test.describe.serial('lot 2 — stage', () => {
  test.setTimeout(240_000);

  // --- Scenario A: room of 30, every state of § 11.3 --------------------------------------------
  test('salle de 30 — connexion, lobby, question, révélation, classement, fin', async ({ page }) => {
    const errors = watchForErrors(page, EXPECTED_ERRORS);
    await page.setViewportSize(VIEWPORTS[S1920]);
    // Controllable clock (intermediate capture of the cascade): JS timers advance on demand,
    // CSS transitions stay in real time. It runs normally as long as it is not paused.
    await page.clock.install();

    // Connecting: session unknown to the mock → no snapshot, the skeleton stays.
    await page.goto('/present/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Connexion à la session…')).toBeVisible();
    await settle(page, 400);
    await capture(page, 'connexion');

    const session = await createSession({ quiz: 'showcase' });
    const Q = session.quiz.questions;
    const pilot = await Pilot.attach(session.id);

    // Empty lobby.
    await page.goto(`/present/${session.id}`);
    await expect(page.getByRole('heading', { name: 'Rejoignez la session' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code pour rejoindre la session' })).toBeVisible();
    await settle(page, 400);
    await capture(page, 'lobby-0');

    // Lobby 3.
    const bots: Bot[] = [];
    for (const name of NAMES_30.slice(0, 3)) bots.push(await Bot.join(session.code, name));
    await expect(page.getByRole('list', { name: 'Participants' }).getByRole('listitem')).toHaveCount(3);
    await settle(page, 700);
    await capture(page, 'lobby-3');

    // « Terminer la session » dialog, then Escape.
    await page.getByRole('button', { name: 'Terminer', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page, 300);
    await capture(page, 'dialog-fin-de-session');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Participants panel (P), then Escape.
    await page.keyboard.press('p');
    await expect(page.getByRole('complementary', { name: 'Participants' })).toBeVisible();
    await settle(page, 400);
    await capture(page, 'panneau-p-ouvert');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Participants' })).toHaveCount(0);

    // Lobby 30.
    for (const name of NAMES_30.slice(3)) bots.push(await Bot.join(session.code, name));
    await expect(page.getByRole('list', { name: 'Participants' }).getByRole('listitem')).toHaveCount(30);
    await settle(page, 1200);
    await capture(page, 'lobby-30', KEY_VIEWPORTS);

    // Q1 — 4-choice MCQ, 20 s timer: 18 answers out of 30, spread out.
    await page.getByRole('button', { name: 'Démarrer le quiz' }).click();
    await waitQuestion(page, Q[0]!);
    const spread4 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 2, 2, 2, 3];
    for (const [i, c] of spread4.entries()) await bots[i]!.choose(0, Q[0]!, c);
    await expect(page.getByText('18 / 30')).toBeVisible();
    await settle(page, 400);
    await capture(page, 'question-qcm-4');
    await pilot.close(0);
    await waitClosed(page);
    await settle(page, 1400);
    await capture(page, 'fermee-avec-top-5');
    // The kit's Switch hides its <input>: click the label.
    await page.getByText('Réponses nominatives', { exact: true }).click();
    await expect(page.getByRole('switch')).toBeChecked();
    await expect(page.getByRole('list', { name: 'Réponses nominatives' })).toBeVisible();
    await settle(page, 300);
    await capture(page, 'reponses-nominatives');
    await page.getByText('Réponses nominatives', { exact: true }).click();
    await expect(page.getByRole('switch')).not.toBeChecked();

    // Q2 — 6-choice MCQ + image, long prompt, 30 s timer; top 5 hidden for the « fermée QCM » state.
    await pilot.next(0);
    await waitQuestion(page, Q[1]!);
    const spread6 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5];
    for (const [i, c] of spread6.entries()) await bots[i]!.choose(1, Q[1]!, c);
    await settle(page, 500);
    await capture(page, 'question-qcm-6-image', KEY_VIEWPORTS);
    await mockJson(`/mock/sessions/${session.id}/settings`, {
      method: 'POST',
      body: JSON.stringify({ showIntermediateRanking: false }),
    });
    // Cascade: clock paused before the close, 200 ms ahead → A, B, C pushed (40 / 100 / 160 ms),
    // D, E, F not yet (220 / 280 / 340 ms). The CSS transitions (320 ms) have time to finish.
    // The fake clock follows real time: settle half a second ahead so it never goes backwards.
    await page.clock.pauseAt(Date.now() + 500);
    await pilot.close(1);
    await waitClosed(page);
    await page.clock.runFor(200);
    await page.waitForTimeout(450);
    await shot(page, LOT, 'fermee-qcm-cascade-t200-1920');
    await page.clock.runFor(2000);
    await page.clock.resume();
    await settle(page, 1200);
    await capture(page, 'fermee-qcm', KEY_VIEWPORTS);

    // Q3 — true/false with an explanation: answers + top 5, the explanation full width below.
    await pilot.next(1);
    await waitQuestion(page, Q[2]!);
    for (const [i, b] of bots.entries()) await (i % 3 === 0 ? b.wrong(2, Q[2]!) : b.correct(2, Q[2]!));
    await mockJson(`/mock/sessions/${session.id}/settings`, {
      method: 'POST',
      body: JSON.stringify({ showIntermediateRanking: true }),
    });
    await pilot.close(2);
    await waitClosed(page);
    await expect(page.getByRole('region', { name: 'Explication' })).toBeVisible();
    await settle(page, 1400);
    await capture(page, 'fermee-avec-explication', KEY_VIEWPORTS);
    await mockJson(`/mock/sessions/${session.id}/settings`, {
      method: 'POST',
      body: JSON.stringify({ showIntermediateRanking: false }),
    });

    // Q4 — numeric: histogram.
    await pilot.next(2);
    await waitQuestion(page, Q[3]!);
    await settle(page, 400);
    await capture(page, 'question-numerique');
    const values = [
      '8',
      '8',
      '8',
      '8',
      '8',
      '8',
      '8',
      '7',
      '16',
      '16',
      '10',
      '4',
      '32',
      '8',
      '12',
      '2',
      '8',
      '64',
    ];
    for (const [i, v] of values.entries()) await bots[i]!.value(3, v);
    await pilot.close(3);
    await expect(page.getByRole('img', { name: /Histogramme des réponses/ })).toBeVisible({
      timeout: 10_000,
    });
    await settle(page, 1400);
    await capture(page, 'fermee-numerique');

    // Q5 — poll: neutral tiles + distribution.
    await pilot.next(3);
    await waitQuestion(page, Q[4]!);
    const spreadPoll = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
    for (const [i, c] of spreadPoll.entries()) await bots[i]!.choose(4, Q[4]!, c);
    await pilot.close(4);
    await waitClosed(page);
    await settle(page, 1400);
    await capture(page, 'fermee-sondage');

    // Q6 — media hidden on phones, visible on the stage: immediate close.
    await pilot.next(4);
    await waitQuestion(page, Q[5]!);
    for (const [i, b] of bots.entries()) if (i < 12) await b.correct(5, Q[5]!);
    await pilot.close(5);
    await waitClosed(page);

    // Final ranking — podium revealed (≥ 2.5 s), rest of the ranking, figures.
    await pilot.next(5);
    await expect(page.getByRole('heading', { name: 'Classement final' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('list', { name: 'Podium' }).getByRole('listitem')).toHaveCount(3);
    await settle(page, 2800);
    await capture(page, 'classement-final', KEY_VIEWPORTS);

    // Reconnection: server-side cut of the presenter sockets (page + driver).
    await mockJson(`/mock/sessions/${session.id}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({ namespace: 'presenter' }),
    });
    await expect(page.getByRole('alert')).toHaveText('Reconnexion…');
    await settle(page, 400);
    await capture(page, 'reconnexion');
    pilot.dispose();

    // Ended: a new driver closes the session, the reloaded page receives an ENDED snapshot.
    const pilot2 = await Pilot.attach(session.id);
    await pilot2.end();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Session terminée' })).toBeVisible({ timeout: 10_000 });
    await settle(page, 400);
    await capture(page, 'ended');

    pilot2.dispose();
    for (const b of bots) b.dispose();
    expect(errors, 'erreurs console (scénario A)').toEqual([]);
  });

  // --- Scenario B: two participants, 5-digit scores, sequencing proven -----------------------------
  test('deux participants — podium à t ≈ 700 ms, podium 2-1, scores à 5 chiffres', async ({ page }) => {
    const errors = watchForErrors(page, EXPECTED_ERRORS);
    await page.setViewportSize(VIEWPORTS[S1920]);
    await page.clock.install();

    const session = await createSession({ quiz: 'showcase', pointsScale: 40 });
    const Q = session.quiz.questions;
    const pilot = await Pilot.attach(session.id);
    const alex = await Bot.join(session.code, 'Alexandre-Benjamin K');
    const zoe = await Bot.join(session.code, 'Zoé');

    await page.goto(`/present/${session.id}`);
    await expect(page.getByRole('heading', { name: 'Rejoignez la session' })).toBeVisible();
    await pilot.start();

    // Alexandre answers correctly everywhere, Zoé gets it wrong: two distinct scores, the first 5-digit.
    for (let i = 0; i < Q.length; i += 1) {
      if (i > 0) await pilot.next(i - 1);
      await waitQuestion(page, Q[i]!);
      await alex.correct(i, Q[i]!);
      await zoe.wrong(i, Q[i]!);
      await pilot.close(i);
      await expect(page.getByRole('button', { name: /Question suivante|Voir le classement/ })).toBeVisible({
        timeout: 10_000,
      });
    }

    // Podium: paused before the ranking, 700 ms ahead → rank 2 is set (600 ms), rank 1 is not
    // revealed yet (1 200 ms); rank 3 does not exist with two participants.
    // The fake clock follows real time: settle half a second ahead so it never goes backwards.
    await page.clock.pauseAt(Date.now() + 500);
    await pilot.next(Q.length - 1);
    await expect(page.getByRole('heading', { name: 'Classement final' })).toBeVisible({ timeout: 10_000 });
    await page.clock.runFor(700);
    await page.waitForTimeout(700);
    await shot(page, LOT, 'podium-t700-1920');
    await page.clock.runFor(3000);
    await page.clock.resume();
    await settle(page, 1200);
    await capture(page, 'classement-final-2-participants');

    pilot.dispose();
    alex.dispose();
    zoe.dispose();
    expect(errors, 'erreurs console (scénario B)').toEqual([]);
  });
});
