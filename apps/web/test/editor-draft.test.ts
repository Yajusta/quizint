// Local editor drafts carry the correct answers: on a shared browser, only the admin who wrote one
// may get it back.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DRAFT_TTL_MS, draftKey, readDraft, writeDraft } from '../src/pages/admin/editor/model.ts';

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
