// « Comptes » (plan § 5.3): every account reaches this page for its own password; an ADMIN also
// gets the account list (role, activation, password reset, each confirmed by `Dialog`) and the
// creation form. The role is read fresh from `/auth/me` here, never trusted from the memo: the
// server refuses a USER anyway (403), this only decides what is worth showing.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { z } from 'zod';

import { AccountRole, ADMIN_PASSWORD_MIN_LENGTH as PASSWORD_MIN, type AdminDTO } from '@quiz/shared';

import { apiJson, apiPath, ApiErrorThrown } from '../../lib/api-client.ts';
import { NBSP } from '../../lib/format.ts';
import { Badge, Button, Card, Dialog, Field, Input, Select } from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { fetchFreshMe, primeMe, redirectIfUnauthorized, type Me } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, ROW } from './AdminLayout.tsx';
import { accountErrorCode, accountRowActions } from './accounts.ts';

const AdminsSchema = z.object({
  admins: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string(),
      role: AccountRole,
      isActive: z.boolean(),
      createdAt: z.number(),
    }),
  ),
});

// Lenient parser on purpose (no uuid/email format check); the shape is the shared `AdminDTO`.
type Admin = AdminDTO;

const IdSchema = z.object({ admin: z.object({ id: z.string() }) });

const FORM: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' };
const FORM_ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-5)',
  flexWrap: 'wrap',
};

export function AdminsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  // `undefined` while `/auth/me` answers, `null` if it failed (only the own-password card then).
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const isAdmin = me?.role === 'ADMIN';

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Deactivation, role change, password reset: one `Dialog` each.
  const [pending, setPending] = useState<Admin | null>(null);
  const [toggling, setToggling] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Admin | null>(null);
  const [changingRole, setChangingRole] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [resetValue, setResetValue] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Account creation
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('USER');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  // Stable callbacks: `Dialog` re-runs its focus effect whenever `onClose` changes identity, which
  // would pull the focus out of the reset field on every keystroke.
  const closeDisable = useCallback(() => setPending(null), []);
  const closeRole = useCallback(() => setRoleTarget(null), []);
  const closeReset = useCallback(() => setResetTarget(null), []);

  /** Message for a failed call: translated for the known refusals, else the server's own text. */
  const describe = (e: unknown, fallbackKey: string): string => {
    const code = accountErrorCode(e);
    if (code) return t(`accounts.apiErrors.${code}`);
    return e instanceof ApiErrorThrown ? e.message : t(fallbackKey);
  };

  /** Reads the role again from the server and publishes it to the top bar. */
  const refreshIdentity = async (): Promise<Me | null> => {
    try {
      const fresh = await fetchFreshMe();
      primeMe(fresh);
      setMe(fresh);
      return fresh;
    } catch (e) {
      if (!redirectIfUnauthorized(e, navigate)) {
        setMe(null);
        setError(t('errors.load'));
      }
      return null;
    }
  };

  /**
   * Common failure path of the management calls: 401 → login; 403 → this account lost the ADMIN
   * role meanwhile, so every management dialog closes and the page falls back to the own-password
   * view; anything else goes to `show`.
   */
  const fail = (e: unknown, show: (message: string) => void, fallbackKey: string) => {
    if (redirectIfUnauthorized(e, navigate)) return;
    if (accountErrorCode(e) === 'FORBIDDEN') {
      setPending(null);
      setRoleTarget(null);
      setResetTarget(null);
      setAdmins([]);
      setError(t('accounts.apiErrors.FORBIDDEN'));
      void refreshIdentity();
      return;
    }
    show(describe(e, fallbackKey));
  };

  const loadAdmins = async () => {
    setLoadingList(true);
    try {
      const a = await apiJson.get('/admins', AdminsSchema);
      setAdmins(a.admins);
    } catch (e) {
      fail(e, setError, 'errors.load');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refreshIdentity().then((fresh) => {
      if (fresh?.role === 'ADMIN') void loadAdmins();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateNotice(null);
    // The primary stays active at rest (lot 1 rule): validate on submit and explain what is
    // missing, rather than showing a dead button with no visible reason.
    if (!email || !displayName) {
      setCreateError(t('accounts.createMissing'));
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setCreateError(t('accounts.passwordTooShort', { count: PASSWORD_MIN }));
      return;
    }
    setCreating(true);
    try {
      await apiJson.post('/admins', { email, displayName, password, role }, IdSchema);
      setCreateNotice(t('accounts.created', { email }));
      setEmail('');
      setDisplayName('');
      setPassword('');
      setRole('USER');
      await loadAdmins();
    } catch (err) {
      fail(err, setCreateError, 'errors.create');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (admin: Admin) => {
    setError(null);
    setNotice(null);
    setToggling(true);
    try {
      await apiJson.patch(apiPath`/admins/${admin.id}`, { isActive: !admin.isActive }, IdSchema);
      await loadAdmins();
    } catch (err) {
      fail(err, setError, 'errors.update');
    } finally {
      setPending(null);
      setToggling(false);
    }
  };

  const changeRole = async (admin: Admin) => {
    setError(null);
    setNotice(null);
    setChangingRole(true);
    const next: AccountRole = admin.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await apiJson.patch(apiPath`/admins/${admin.id}`, { role: next }, IdSchema);
      setNotice(t('accounts.roleUpdated', { name: admin.displayName }));
      await loadAdmins();
    } catch (err) {
      fail(err, setError, 'errors.update');
    } finally {
      setRoleTarget(null);
      setChangingRole(false);
    }
  };

  const openReset = (admin: Admin) => {
    setNotice(null);
    setResetValue('');
    setResetError(null);
    setResetTarget(admin);
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    if (resetValue.length < PASSWORD_MIN) {
      setResetError(t('accounts.passwordTooShort', { count: PASSWORD_MIN }));
      return;
    }
    setResetting(true);
    try {
      await apiJson.post(apiPath`/admins/${resetTarget.id}/password`, { password: resetValue }, z.unknown());
      setNotice(t('accounts.passwordReset', { name: resetTarget.displayName }));
      setResetTarget(null);
      setResetValue('');
    } catch (err) {
      fail(err, setResetError, 'errors.update');
    } finally {
      setResetting(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordError(t('accounts.currentPasswordMissing'));
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setPasswordError(t('accounts.newPasswordTooShort', { count: PASSWORD_MIN }));
      return;
    }
    setChanging(true);
    try {
      await apiJson.post('/auth/change-password', { currentPassword, newPassword }, z.object({}));
      setPasswordNotice(t('accounts.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(describe(err, 'errors.update'));
    } finally {
      setChanging(false);
    }
  };

  const passwordHint = (
    <>
      <Num>{PASSWORD_MIN}</Num>
      {NBSP}
      {t('accounts.passwordHint')}
    </>
  );

  if (me === undefined) {
    return (
      <AdminLayout>
        <ListSkeleton rows={3} />
      </AdminLayout>
    );
  }

  const demoting = roleTarget?.role === 'ADMIN';

  return (
    <AdminLayout>
      <PageHeader title={isAdmin ? t('accounts.title') : t('accounts.titleOwn')} />

      {error && <ErrorAlert>{error}</ErrorAlert>}
      {notice && (
        <div role="status">
          <Badge tone="success">{notice}</Badge>
        </div>
      )}

      {isAdmin && loadingList && admins.length === 0 && <ListSkeleton rows={3} />}

      {isAdmin && admins.length > 0 && (
        <section
          aria-label={t('accounts.listLabel')}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          {admins.map((a, i) => {
            const actions = accountRowActions(a, me.id);
            return (
              <Card key={a.id} padding="sm" style={riseStyle(i)}>
                <div style={ROW}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}
                  >
                    <span style={{ font: 'var(--text-h3)' }}>{a.displayName}</span>
                    <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                      {a.email}
                    </span>
                    <Badge tone={a.role === 'ADMIN' ? 'brand' : 'neutral'}>
                      {t(`accounts.role.${a.role}`)}
                    </Badge>
                    {a.id === me.id && <Badge tone="neutral">{t('accounts.you')}</Badge>}
                    {!a.isActive && <Badge tone="danger">{t('accounts.disabled')}</Badge>}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {actions.changeRole && (
                      <Button size="sm" variant="ghost" onClick={() => setRoleTarget(a)}>
                        {a.role === 'ADMIN' ? t('accounts.makeUser') : t('accounts.makeAdmin')}
                      </Button>
                    )}
                    {actions.resetPassword && (
                      <Button size="sm" variant="ghost" onClick={() => openReset(a)}>
                        {t('accounts.resetPassword')}
                      </Button>
                    )}
                    {actions.toggleActive && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => (a.isActive ? setPending(a) : void toggleActive(a))}
                      >
                        {a.isActive ? t('accounts.disable') : t('accounts.enable')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <section
        aria-label={t('accounts.settingsLabel')}
        style={{
          display: 'grid',
          // `auto-fill` keeps the empty track when the password card is alone (a USER): the card
          // keeps its column width instead of stretching across the page.
          gridTemplateColumns: `repeat(${isAdmin ? 'auto-fit' : 'auto-fill'}, minmax(320px, 1fr))`,
          gap: 'var(--space-7)',
          alignItems: 'start',
        }}
      >
        {/* `noValidate`: validation is done in JS and rendered by `ErrorAlert`, not by the browser's
            native bubble — which would short-circuit `onSubmit` and step outside the kit. */}
        {isAdmin && (
          <Card header={t('accounts.createCard')}>
            <form onSubmit={create} noValidate style={FORM}>
              <Field label={t('accounts.email')} htmlFor="new-admin-email">
                <Input
                  id="new-admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  error={createError !== null}
                />
              </Field>
              <Field label={t('accounts.displayName')} htmlFor="new-admin-name">
                <Input
                  id="new-admin-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="off"
                  error={createError !== null}
                />
              </Field>
              <Field label={t('accounts.password')} htmlFor="new-admin-password" hint={passwordHint}>
                <Input
                  id="new-admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  error={createError !== null}
                />
              </Field>
              <Field label={t('accounts.roleLabel')} htmlFor="new-admin-role" hint={t('accounts.roleHint')}>
                <Select
                  id="new-admin-role"
                  value={role}
                  onChange={(e) => setRole(AccountRole.catch('USER').parse(e.target.value))}
                  options={[
                    { value: 'USER', label: t('accounts.role.USER') },
                    { value: 'ADMIN', label: t('accounts.role.ADMIN') },
                  ]}
                />
              </Field>
              {createError && <ErrorAlert>{createError}</ErrorAlert>}
              <div style={FORM_ACTIONS}>
                <Button type="submit" loading={creating}>
                  {t('accounts.create')}
                </Button>
                {createNotice && <Badge tone="success">{createNotice}</Badge>}
              </div>
            </form>
          </Card>
        )}

        <Card header={t('accounts.passwordCard')}>
          <form onSubmit={changePassword} noValidate style={FORM}>
            <Field label={t('accounts.currentPassword')} htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                error={passwordError !== null}
              />
            </Field>
            <Field label={t('accounts.newPassword')} htmlFor="new-password" hint={passwordHint}>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                error={passwordError !== null}
              />
            </Field>
            {passwordError && <ErrorAlert>{passwordError}</ErrorAlert>}
            <div style={FORM_ACTIONS}>
              <Button type="submit" variant="secondary" loading={changing}>
                {t('accounts.updatePassword')}
              </Button>
              {passwordNotice && <Badge tone="success">{passwordNotice}</Badge>}
            </div>
          </form>
        </Card>
      </section>

      <Dialog
        open={pending !== null}
        title={t('accounts.disableTitle')}
        description={pending ? t('accounts.disableDescription', { name: pending.displayName }) : undefined}
        onClose={closeDisable}
        footer={
          <>
            <Button variant="ghost" onClick={closeDisable}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="danger" loading={toggling} onClick={() => pending && void toggleActive(pending)}>
              {t('accounts.disable')}
            </Button>
          </>
        }
      />

      <Dialog
        open={roleTarget !== null}
        title={demoting ? t('accounts.demoteTitle') : t('accounts.promoteTitle')}
        description={
          roleTarget
            ? t(demoting ? 'accounts.demoteDescription' : 'accounts.promoteDescription', {
                name: roleTarget.displayName,
              })
            : undefined
        }
        onClose={closeRole}
        footer={
          <>
            <Button variant="ghost" onClick={closeRole}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant={demoting ? 'danger' : 'primary'}
              loading={changingRole}
              onClick={() => roleTarget && void changeRole(roleTarget)}
            >
              {demoting ? t('accounts.makeUser') : t('accounts.makeAdmin')}
            </Button>
          </>
        }
      />

      <Dialog
        open={resetTarget !== null}
        title={t('accounts.resetTitle')}
        description={
          resetTarget ? t('accounts.resetDescription', { name: resetTarget.displayName }) : undefined
        }
        onClose={closeReset}
        footer={
          <>
            <Button variant="ghost" onClick={closeReset}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" form="reset-password-form" loading={resetting}>
              {t('accounts.resetConfirm')}
            </Button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={resetPassword} noValidate style={FORM}>
          <Field label={t('accounts.newPassword')} htmlFor="reset-password" hint={passwordHint}>
            <Input
              id="reset-password"
              type="password"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
              autoComplete="new-password"
              error={resetError !== null}
            />
          </Field>
          {resetError && <ErrorAlert>{resetError}</ErrorAlert>}
        </form>
      </Dialog>
    </AdminLayout>
  );
}
