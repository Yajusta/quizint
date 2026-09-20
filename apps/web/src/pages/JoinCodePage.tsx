// Home page (§8.4, plan § 5.1 « Code ») : session code entry + discreet presenter link.

import { useState, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { SESSION_CODE_LENGTH } from '@quiz/shared';

import { Button, Field, Input } from '../design-system/index.ts';
import { useThemeColor } from '../lib/useThemeColor.ts';
import { LightShell, Num } from './participant/shells.tsx';

/** Keeps the code characters; the display groups them « ABC 123 » (skill JoinCode). */
function cleanCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SESSION_CODE_LENGTH);
}

function displayCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export function JoinCodePage() {
  const { t } = useTranslation(['participant', 'common']);
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<ReactNode>(null);
  useThemeColor('light');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== SESSION_CODE_LENGTH) {
      setError(
        <Trans
          i18nKey="joinCode.lengthError"
          ns="participant"
          values={{ count: SESSION_CODE_LENGTH }}
          components={{ num: <Num /> }}
        />,
      );
      return;
    }
    navigate(`/j/${code}`);
  };

  return (
    <LightShell
      footer={
        <Link
          to="/admin/login"
          style={{
            color: 'var(--text-secondary)',
            borderBottom: '1px solid transparent',
            padding: 'var(--space-3)',
          }}
        >
          {t('joinCode.presenterLink')}
        </Link>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h1 style={{ textWrap: 'balance' }}>{t('joinCode.title')}</h1>
          <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)' }}>{t('joinCode.hint')}</p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
        >
          <Field
            label={t('joinCode.fieldLabel')}
            htmlFor="session-code"
            error={error ? <span role="alert">{error}</span> : undefined}
          >
            <Input
              id="session-code"
              size="xl"
              value={displayCode(code)}
              onChange={(e) => {
                setCode(cleanCode(e.target.value));
                setError(null);
              }}
              placeholder={t('joinCode.placeholder')}
              // Code plus the grouping space of displayCode.
              maxLength={SESSION_CODE_LENGTH + 1}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              autoFocus={window.matchMedia('(pointer: fine)').matches}
              error={Boolean(error)}
              aria-invalid={Boolean(error)}
              style={{
                font: 'var(--text-numeric)',
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: 'var(--tracking-code)',
                textAlign: 'center',
              }}
            />
          </Field>
          <Button type="submit" size="xl" block iconRight="arrow-right">
            {t('common:actions.join')}
          </Button>
        </form>
      </div>
    </LightShell>
  );
}
