// Back-office login (plan § 5.3): wordmark centred above a 400 px card.
// The authentication logic (httpOnly cookie, undifferentiated error message) is unchanged.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { LanguageSwitcher } from '../../components/LanguageSwitcher.tsx';
import { Button, Card, Field, Input, Wordmark } from '../../design-system/index.ts';
import { resetMe } from '../../lib/admin-identity.ts';

export function LoginPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // The primary is never disabled at rest (lot 1 rule): validate on submit.
    if (!email || !password) {
      setError(t('login.errorMissing'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // New session: the name cached by the top bar is the previous account's until it is
        // thrown away.
        resetMe();
        navigate('/admin');
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { code: string } } | null;
      setError(
        body?.error?.code === 'RATE_LIMITED' ? t('login.errorRateLimited') : t('login.errorCredentials'),
      );
    } catch {
      setError(t('login.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-8)',
        padding: 'var(--space-9) var(--gutter-page)',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
      }}
    >
      <Wordmark size="md" />
      <LanguageSwitcher size="sm" />

      <Card padding="lg" style={{ width: 'min(400px, 100%)' }}>
        {/* `noValidate`: the error is rendered by the kit (`role=alert`), not by the browser's
            native bubble, which would short-circuit `onSubmit`. */}
        <form
          onSubmit={submit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
        >
          <h1 style={{ font: 'var(--text-h2)', letterSpacing: 'var(--tracking-tight)' }}>
            {t('login.title')}
          </h1>

          <Field label={t('login.email')} htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              error={error !== null}
            />
          </Field>

          <Field label={t('login.password')} htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={error !== null}
            />
          </Field>

          {error && (
            <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--state-danger)' }}>
              {error}
            </p>
          )}

          <Button type="submit" size="lg" block loading={loading}>
            {t('login.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
