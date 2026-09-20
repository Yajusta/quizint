// Lot 5 — `prefers-reduced-motion` (plan § 10: « aucune animation résiduelle, compteurs et podium
// en affichage direct »).
//
// Prerequisites: `pnpm mock:live` (:4001) and `MOCK=1 pnpm --filter @quiz/web dev` (:5173).
//
// The proof is not the capture but the **moment** of the capture: both screens are read
// well before the end of their normal sequence (podium revealed over 2 400 ms, `CountUp` over
// 600 ms, staggered `qiRise` entries). If anything were still animating, the rank 1 score
// would be at 0 and the participant's delta would be incomplete.

import { expect, test, type Page } from '@playwright/test';

import {
  escapeRe,
  MOCK_EXPECTED_ERRORS as EXPECTED_ERRORS,
  shot,
  VIEWPORTS,
  watchForErrors,
} from './helpers';
import { Bot, createSession, Presenter } from './mock-driver';

/** Margin left to the React render, well under the podium's 2 400 ms and the CountUp's 600 ms. */
const IMMEDIATE_MS = 250;

test.use({ reducedMotion: 'reduce' });

test.describe.serial('lot 5 — prefers-reduced-motion', () => {
  test.setTimeout(120_000);

  test('podium du stage et retour participant : affichage direct, sans séquence', async ({ browser }) => {
    const stage = await browser.newPage({ reducedMotion: 'reduce' });
    const phone = await browser.newPage({ reducedMotion: 'reduce' });
    const stageErrors = watchForErrors(stage, EXPECTED_ERRORS);
    const phoneErrors = watchForErrors(phone, EXPECTED_ERRORS);

    // The preference is seen by the JS components (Podium, CountUp, cascade read matchMedia).
    for (const page of [stage, phone]) {
      await page.setViewportSize(VIEWPORTS['stage-1920']);
    }
    await phone.setViewportSize(VIEWPORTS['participant-390']);

    const session = await createSession('showcase');
    const Q = session.quiz.questions;
    const presenter = await Presenter.attach(session.id);
    const bots = [
      await Bot.join(session.code, 'Nour', 'correct'),
      await Bot.join(session.code, 'Théo', 'wrong'),
    ];

    await stage.goto(`/present/${session.id}`, { waitUntil: 'networkidle' });
    await expect(stage.getByRole('heading', { name: 'Rejoignez la session' })).toBeVisible({
      timeout: 15_000,
    });

    await phone.goto(`/j/${session.code}`, { waitUntil: 'networkidle' });
    await phone.getByLabel('Votre pseudonyme').fill('Camille');
    await phone.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(phone.getByRole('heading', { name: 'Vous êtes dans la salle' })).toBeVisible();

    expect(await prefersReduced(stage), 'le stage doit voir reduced-motion').toBe(true);
    expect(await prefersReduced(phone), 'le téléphone doit voir reduced-motion').toBe(true);

    // --- Participant feedback: the delta and the score are complete right away ----------------
    await presenter.start();
    await expect(phone.getByRole('heading', { name: Q[0]!.prompt })).toBeVisible({ timeout: 15_000 });
    const correct = Q[0]!.choices.find((c) => c.isCorrect)!;
    await phone.getByRole('button', { name: new RegExp(`Choix [A-F].*${escapeRe(correct.label)}`) }).click();
    await expect(phone.getByText('Réponse enregistrée')).toBeVisible({ timeout: 10_000 });
    for (const b of bots) await b.answer(0, Q[0]!);
    await presenter.close(0);

    await expect(phone.getByRole('heading', { name: 'Bonne réponse' })).toBeVisible({ timeout: 10_000 });
    await phone.waitForTimeout(IMMEDIATE_MS);
    // The delta carries its final `aria-label`; the rendered figure must already equal it.
    const delta = phone.locator('p[aria-label^="+"]').first();
    const label = (await delta.getAttribute('aria-label')) ?? '';
    const shownDelta = digits(await delta.innerText());
    expect(shownDelta, `delta affiché (${label})`).toBe(digits(label));
    expect(shownDelta.length, 'le delta ne doit pas être nul').toBeGreaterThan(0);
    // The « Score » StatTile counts from the previous score to the new one: immediate here too.
    const score = phone.getByText('Score', { exact: true }).locator('..');
    expect(digits(await score.innerText()), 'score du participant').toBe(shownDelta);
    await phone.evaluate(() => document.fonts.ready);
    await shot(phone, 'participant', 'reduced-motion-retour-390');

    // --- Stage podium: the three blocks and their scores are set right away -------------------
    for (let i = 1; i < Q.length; i += 1) {
      await presenter.next(i - 1);
      for (const b of bots) await b.answer(i, Q[i]!);
      await presenter.close(i);
    }
    await presenter.next(Q.length - 1);

    const podium = stage.getByRole('list', { name: 'Podium' });
    await expect(podium).toBeVisible({ timeout: 15_000 });
    await stage.waitForTimeout(IMMEDIATE_MS);

    const items = podium.getByRole('listitem');
    await expect(items).toHaveCount(3);
    for (const item of await items.all()) {
      // `aria-label` = « 1er, Camille, 8 420 points »: the rendered score must already be the final one.
      const aria = (await item.getAttribute('aria-label')) ?? '';
      expect(digits(await item.innerText()), `bloc « ${aria} »`).toContain(digits(aria.split(',')[2] ?? ''));
      await expect(item).toHaveCSS('opacity', '1');
    }
    await stage.evaluate(() => document.fonts.ready);
    await shot(stage, 'stage', 'reduced-motion-podium-1920');

    expect(stageErrors, 'erreurs console du stage').toEqual([]);
    expect(phoneErrors, 'erreurs console du téléphone').toEqual([]);

    for (const b of bots) b.dispose();
    presenter.dispose();
    await stage.close();
    await phone.close();
  });
});

function prefersReduced(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Digits only: compares values without depending on group spaces or on the sign. */
function digits(s: string): string {
  return s.replace(/\D+/g, '');
}
