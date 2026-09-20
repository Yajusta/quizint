// « Comptes admin » (plan § 5.3): account list, deactivation confirmed by `Dialog`,
// two form cards. The REST calls and their rules (12 characters) are unchanged.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { z } from 'zod';

import { ADMIN_PASSWORD_MIN_LENGTH as PASSWORD_MIN, type AdminDTO } from '@quiz/shared';

import { apiJson, ApiErrorThrown } from '../../lib/api-client.ts';
import { NBSP } from '../../lib/format.ts';
import { Badge, Button, Card, Dialog, Field, Input } from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, ROW } from './AdminLayout.tsx';

const AdminsSchema = z.object({
  admins: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string(),
      isActive: z.boolean(),
      createdAt: z.number(),
    }),
  ),
});

// Lenient parser on purpose (no uuid/email format check); the shape is the shared `AdminDTO`.
type Admin = AdminDTO;

export function AdminsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Admin | null>(null);
  const [toggling, setToggling] = useState(false);

  // Account creation
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const load = () =>
    apiJson
      .get('/admins', AdminsSchema)
      .then((a) => setAdmins(a.admins))
      .catch((e) => {
        if (!redirectIfUnauthorized(e, navigate)) setError(t('errors.load'));
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
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
      await apiJson.post(
        '/admins',
        { email, displayName, password },
        z.object({ admin: z.object({ id: z.string() }) }),
      );
      setCreateNotice(t('accounts.created', { email }));
      setEmail('');
      setDisplayName('');
      setPassword('');
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiErrorThrown ? err.message : t('errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (admin: Admin) => {
    setError(null);
    setToggling(true);
    try {
      await apiJson.patch(
        `/admins/${admin.id}`,
        { isActive: !admin.isActive },
        z.object({ admin: z.object({ id: z.string() }) }),
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiErrorThrown ? err.message : t('errors.update'));
    } finally {
      setPending(null);
      setToggling(false);
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
      setPasswordError(err instanceof ApiErrorThrown ? err.message : t('errors.update'));
    } finally {
      setChanging(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader title={t('accounts.title')} />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading && <ListSkeleton rows={3} />}

      {!loading && (
        <section
          aria-label={t('accounts.listLabel')}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          {admins.map((a, i) => (
            <Card key={a.id} padding="sm" style={riseStyle(i)}>
              <div style={ROW}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}
                >
                  <span style={{ font: 'var(--text-h3)' }}>{a.displayName}</span>
                  <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                    {a.email}
                  </span>
                  {!a.isActive && <Badge tone="danger">{t('accounts.disabled')}</Badge>}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => (a.isActive ? setPending(a) : void toggleActive(a))}
                >
                  {a.isActive ? t('accounts.disable') : t('accounts.enable')}
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section
        aria-label={t('accounts.settingsLabel')}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-7)',
          alignItems: 'start',
        }}
      >
        {/* `noValidate`: validation is done in JS and rendered by `ErrorAlert`, not by the browser's
            native bubble — which would short-circuit `onSubmit` and step outside the kit. */}
        <Card header={t('accounts.createCard')}>
          <form
            onSubmit={create}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
          >
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
            <Field
              label={t('accounts.password')}
              htmlFor="new-admin-password"
              hint={
                <>
                  <Num>{PASSWORD_MIN}</Num>
                  {NBSP}
                  {t('accounts.passwordHint')}
                </>
              }
            >
              <Input
                id="new-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                error={createError !== null}
              />
            </Field>
            {createError && <ErrorAlert>{createError}</ErrorAlert>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <Button type="submit" loading={creating}>
                {t('accounts.create')}
              </Button>
              {createNotice && <Badge tone="success">{createNotice}</Badge>}
            </div>
          </form>
        </Card>

        <Card header={t('accounts.passwordCard')}>
          <form
            onSubmit={changePassword}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
          >
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
            <Field
              label={t('accounts.newPassword')}
              htmlFor="new-password"
              hint={
                <>
                  <Num>{PASSWORD_MIN}</Num>
                  {NBSP}
                  {t('accounts.passwordHint')}
                </>
              }
            >
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
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
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="danger" loading={toggling} onClick={() => pending && void toggleActive(pending)}>
              {t('accounts.disable')}
            </Button>
          </>
        }
      />
    </AdminLayout>
  );
}
