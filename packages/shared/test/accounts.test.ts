import { describe, expect, it } from 'vitest';

import { toAccountRole, wouldRemoveLastAdmin } from '../src/accounts.js';

describe('toAccountRole', () => {
  it('keeps a known role and reads anything else as USER', () => {
    expect(toAccountRole('ADMIN')).toBe('ADMIN');
    expect(toAccountRole('USER')).toBe('USER');
    expect(toAccountRole('admin')).toBe('USER');
    expect(toAccountRole('')).toBe('USER');
  });
});

const activeAdmin = { role: 'ADMIN', isActive: true } as const;

describe('wouldRemoveLastAdmin', () => {
  it('flags demoting the last active admin', () => {
    expect(wouldRemoveLastAdmin(activeAdmin, { role: 'USER' }, 1)).toBe(true);
  });

  it('flags deactivating the last active admin', () => {
    expect(wouldRemoveLastAdmin(activeAdmin, { isActive: false }, 1)).toBe(true);
  });

  it('flags demoting and deactivating the last active admin at once', () => {
    expect(wouldRemoveLastAdmin(activeAdmin, { role: 'USER', isActive: false }, 1)).toBe(true);
  });

  it('allows it when another active admin remains', () => {
    expect(wouldRemoveLastAdmin(activeAdmin, { role: 'USER' }, 2)).toBe(false);
    expect(wouldRemoveLastAdmin(activeAdmin, { isActive: false }, 2)).toBe(false);
    expect(wouldRemoveLastAdmin(activeAdmin, { role: 'USER', isActive: false }, 3)).toBe(false);
  });

  it('ignores a target that is a USER', () => {
    expect(wouldRemoveLastAdmin({ role: 'USER', isActive: true }, { isActive: false }, 1)).toBe(false);
    expect(wouldRemoveLastAdmin({ role: 'USER', isActive: true }, { role: 'USER' }, 0)).toBe(false);
  });

  it('ignores a target that is an inactive admin', () => {
    expect(wouldRemoveLastAdmin({ role: 'ADMIN', isActive: false }, { role: 'USER' }, 1)).toBe(false);
    expect(wouldRemoveLastAdmin({ role: 'ADMIN', isActive: false }, { isActive: false }, 0)).toBe(false);
  });

  it('ignores a patch that keeps the admin active', () => {
    expect(wouldRemoveLastAdmin(activeAdmin, {}, 1)).toBe(false);
    expect(wouldRemoveLastAdmin(activeAdmin, { role: 'ADMIN', isActive: true }, 1)).toBe(false);
    expect(wouldRemoveLastAdmin(activeAdmin, { role: undefined, isActive: undefined }, 1)).toBe(false);
  });

  it('allows reactivating or promoting', () => {
    expect(wouldRemoveLastAdmin({ role: 'ADMIN', isActive: false }, { isActive: true }, 0)).toBe(false);
    expect(wouldRemoveLastAdmin({ role: 'USER', isActive: true }, { role: 'ADMIN' }, 1)).toBe(false);
  });
});
