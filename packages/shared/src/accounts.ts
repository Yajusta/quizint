// Account rules shared by the API guards and the admin UI. Pure, no I/O.

import { AccountRole } from './schemas/domain.js';
import type { AdminDTO, AdminPatchInput } from './schemas/rest.js';

// Narrows a stored role (a String column, SQLite has no enum). Anything unexpected reads as USER:
// a corrupt value must never grant account management.
export function toAccountRole(value: string): AccountRole {
  const parsed = AccountRole.safeParse(value);
  return parsed.success ? parsed.data : 'USER';
}

// True when applying `patch` to `target` would leave no active ADMIN: the target is an active ADMIN
// today, the patch demotes or deactivates it, and it is the only one (`activeAdminCount` counts the
// target itself). The caller must read `activeAdminCount` and write the patch in one transaction,
// on every path that can demote or deactivate: two ADMINs demoting each other off stale counts would
// otherwise both pass and leave none.
export function wouldRemoveLastAdmin(
  target: Pick<AdminDTO, 'role' | 'isActive'>,
  patch: Pick<AdminPatchInput, 'role' | 'isActive'>,
  activeAdminCount: number,
): boolean {
  if (target.role !== 'ADMIN' || !target.isActive) return false;
  const staysActiveAdmin = (patch.role ?? target.role) === 'ADMIN' && (patch.isActive ?? target.isActive);
  return !staysActiveAdmin && activeAdminCount <= 1;
}
