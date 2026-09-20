// The dictionaries are plain TS modules, not a translation platform: nothing but this test stops a
// key from being added to `fr/` and forgotten in `en/`. A missing key does not crash i18next — it
// falls back to French, so the English UI would silently go bilingual.

import { describe, expect, it } from 'vitest';

import { validateQuestionShape } from '@quiz/shared';

import { SUPPORTED_LANGUAGES, type Language } from '../src/i18n/languages.ts';

import frAdmin from '../src/i18n/locales/fr/admin.ts';
import frCommon from '../src/i18n/locales/fr/common.ts';
import frParticipant from '../src/i18n/locales/fr/participant.ts';
import frPresenter from '../src/i18n/locales/fr/presenter.ts';
import enAdmin from '../src/i18n/locales/en/admin.ts';
import enCommon from '../src/i18n/locales/en/common.ts';
import enParticipant from '../src/i18n/locales/en/participant.ts';
import enPresenter from '../src/i18n/locales/en/presenter.ts';

type Dict = { [key: string]: string | Dict };

const NAMESPACES: Record<string, { fr: Dict; en: Dict }> = {
  common: { fr: frCommon, en: enCommon },
  participant: { fr: frParticipant, en: enParticipant },
  presenter: { fr: frPresenter, en: enPresenter },
  admin: { fr: frAdmin, en: enAdmin },
};

/** Flattened `a.b.c` paths of every leaf string. */
function paths(dict: Dict, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : paths(value, path);
  });
}

/** `{{name}}` placeholders and `<tag>` markers a translation must keep. */
function markers(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)[^}]*\}\}|<(\/?\w+)>/g)].map((m) => m[0]).sort();
}

function leaf(dict: Dict, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<string | Dict | undefined>(
      (node, key) => (node && typeof node !== 'string' ? node[key] : undefined),
      dict,
    );
  return typeof value === 'string' ? value : undefined;
}

describe('i18n dictionaries', () => {
  it('ships one folder per supported language', () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['en', 'fr']);
  });

  // The editor stores these two labels as the question's content and the server validates them:
  // a language whose pair is missing from the shared list cannot save a true/false question.
  it('writes true/false labels the server accepts, in every language', () => {
    // `Record<Language, …>`: a language added to SUPPORTED_LANGUAGES fails the typecheck until it is listed.
    const admins: Record<Language, typeof frAdmin> = { fr: frAdmin, en: enAdmin };
    for (const lng of SUPPORTED_LANGUAGES) {
      const admin = admins[lng];
      const question = {
        type: 'TRUE_FALSE' as const,
        choices: [
          { label: admin.trueFalse.true, isCorrect: true },
          { label: admin.trueFalse.false, isCorrect: false },
        ],
        numericAnswer: null,
        pointsCorrect: 100,
        pointsWrong: 0,
        speedBonusMax: 0,
        timeLimitSec: null,
      };
      expect(validateQuestionShape(question), lng).toEqual([]);
    }
  });

  for (const [namespace, { fr, en }] of Object.entries(NAMESPACES)) {
    describe(namespace, () => {
      const frPaths = paths(fr);
      const enPaths = paths(en);

      it('has the same keys in both languages', () => {
        expect(enPaths.slice().sort()).toEqual(frPaths.slice().sort());
      });

      it('has no empty string', () => {
        for (const path of frPaths) expect(leaf(fr, path), `fr:${namespace}.${path}`).toBeTruthy();
        for (const path of enPaths) expect(leaf(en, path), `en:${namespace}.${path}`).toBeTruthy();
      });

      it('keeps the same interpolations and markup in both languages', () => {
        for (const path of frPaths) {
          const frText = leaf(fr, path);
          const enText = leaf(en, path);
          if (frText === undefined || enText === undefined) continue;
          expect(markers(enText), `${namespace}.${path}`).toEqual(markers(frText));
        }
      });
    });
  }
});
