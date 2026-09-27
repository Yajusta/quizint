// Local editor drafts carry the correct answers: on a shared browser, only the admin who wrote one
// may get it back.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DRAFT_TTL_MS,
  draftKey,
  lateDraftToOffer,
  readDraft,
  writeDraft,
} from '../src/pages/admin/editor/model.ts';

const ADMIN_A = '00000000-0000-4000-8000-00000000000a';
const ADMIN_B = '00000000-0000-4000-8000-00000000000b';
const QUIZ_ID = '00000000-0000-4000-8000-000000000001';

const content = { title: 'Capitales', description: '', questions: [] };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  ['new quiz', draftKey(null)],
  ['existing quiz', draftKey(QUIZ_ID)],
])('editor draft (%s)', (_label, key) => {
  it('gives the draft back to the admin who wrote it', () => {
    writeDraft(key, ADMIN_A, content);
    expect(readDraft(key, ADMIN_A)).toMatchObject({ ...content, author: ADMIN_A });
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('never shows it to another admin, and removes it', () => {
    writeDraft(key, ADMIN_A, content);
    expect(readDraft(key, ADMIN_B)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    // Dropped for good: the author does not find it either.
    expect(readDraft(key, ADMIN_A)).toBeNull();
  });

  it('drops a legacy draft that names no author', () => {
    localStorage.setItem(key, JSON.stringify({ ...content, at: Date.now() }));
    expect(readDraft(key, ADMIN_A)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('drops an expired draft', () => {
    localStorage.setItem(
      key,
      JSON.stringify({ ...content, at: Date.now() - DRAFT_TTL_MS - 1, author: ADMIN_A }),
    );
    expect(readDraft(key, ADMIN_A)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('drops an unreadable draft', () => {
    localStorage.setItem(key, '{not json');
    expect(readDraft(key, ADMIN_A)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});

// `/auth/me` failed at load, so the stored draft was never offered; a later retry confirms the admin
// while the screen is already edited. The first autosave must not overwrite that draft unseen.
describe('late-confirmed draft owner', () => {
  const key = draftKey(QUIZ_ID);
  const stored = { title: 'Capitales', description: 'Europe', questions: [] };
  const edited = { title: 'Capitale', description: '', questions: [] };
  const saved = { title: 'Capitale', description: '', questions: '[]' };

  it('offers the admin their own stored draft when it differs from the screen', () => {
    writeDraft(key, ADMIN_A, stored);
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, saved)).toMatchObject({
      ...stored,
      author: ADMIN_A,
    });
  });

  it('offers nothing when the stored draft matches the screen (whitespace aside)', () => {
    writeDraft(key, ADMIN_A, stored);
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), { ...stored, title: ' Capitales ' }, saved)).toBeNull();
  });

  it('offers nothing when no draft is stored, or an empty one', () => {
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, saved)).toBeNull();
    writeDraft(key, ADMIN_A, { title: '', description: 'Seule', questions: [] });
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, saved)).toBeNull();
  });

  it('offers nothing when the stored draft equals the saved version', () => {
    writeDraft(key, ADMIN_A, stored);
    const same = { title: 'Capitales', description: 'Europe', questions: '[]' };
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, same)).toBeNull();
  });

  it('offers nothing for a malformed draft of an older shape, instead of throwing', () => {
    localStorage.setItem(
      key,
      JSON.stringify({ ...stored, questions: [{ key: 'q1' }], at: Date.now(), author: ADMIN_A }),
    );
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, saved)).toBeNull();
  });

  it('never offers a draft written by another admin, which is removed on read', () => {
    writeDraft(key, ADMIN_B, stored);
    expect(lateDraftToOffer(readDraft(key, ADMIN_A), edited, saved)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});
