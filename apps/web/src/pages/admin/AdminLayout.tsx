// Back-office shell (plan § 5.3): 56 px white top bar, wordmark on the left, `Tabs` in the centre
// derived from `useLocation`, identity + logout on the right. No side rail (deviation § 7-4:
// three entries do not justify a `SideNav`). The content fits within `--max-content`.

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { LanguageSwitcher } from '../../components/LanguageSwitcher.tsx';
import { resetMe, useMe } from '../../lib/admin-identity.ts';
import { Badge, Button, Tabs, Wordmark } from '../../design-system/index.ts';
import { clearAllDrafts } from './editor/model.ts';

/** Active tab derived from the URL — the editor and the session detail stay under their section. */
function tabFor(pathname: string): string {
  if (pathname.startsWith('/admin/sessions')) return '/admin/sessions';
  if (pathname.startsWith('/admin/admins')) return '/admin/admins';
  return '/admin';
}

/**
 * List entry: `qiRise` staggered by 30 ms on the first eight items (§ 5.3). Beyond that,
 * no animation — a long list must not unroll for a whole second.
 * `prefers-reduced-motion` sets `--dur-base` to zero, so the display is immediate.
 *
 * `backwards` rather than `both`: `both` keeps the keyframe's final state (`transform: none`)
 * after the animation and overrode the hover `translateY(-1px)` on the first eight cards.
 * `backwards` only applies the initial state during the delay, then hands control back.
 */
export function riseStyle(index: number): CSSProperties | undefined {
  if (index >= 8) return undefined;
  return { animation: `qiRise var(--dur-base) var(--ease-out) ${index * 30}ms backwards` };
}

/**
 * Row of a list card: label on the left, actions on the right. To be set on a **child** of
 * `Card`, never on the card itself: `Card` already wraps its children in its padding container,
 * so a `display: flex` set on the card does not reach them.
 */
export const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  flexWrap: 'wrap',
};

/** Digits inside running text: mono everywhere (§ 3, « chiffres en --font-mono »). */
export { Num } from '../participant/shells.tsx';

/** Page error (§ 11.4 crit. 7): `role="alert"`, `--state-danger`, body-sm. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--state-danger)' }}>
      {children}
    </p>
  );
}

/** Page header: h1 title, secondary subtitle, actions aligned to the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-7)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h1 style={{ font: 'var(--text-h1)', letterSpacing: 'var(--tracking-tight)' }}>{title}</h1>
        {subtitle && <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 'var(--space-4)' }}>{actions}</div>}
    </header>
  );
}

/** Section title — one step under the h1, never a second colour. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ font: 'var(--text-h2)', letterSpacing: 'var(--tracking-tight)' }}>{children}</h2>;
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Top bar identity (§ 5.3 « admin courant si dispo »). Informative only: any error leaves the
  // badge hidden, the 401 redirect remains each page's business, and the server enforces roles.
  const me = useMe();
  const displayName = me?.displayName ?? null;

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    resetMe();
    clearAllDrafts();
    navigate('/admin/login');
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', color: 'var(--text-primary)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* The bar is full width, but its inner row follows the same leash as the content
            (`--max-content` + `--gutter-page`): wordmark and h1 on the same vertical line. */}
        <div
          style={{
            height: 56,
            width: '100%',
            maxWidth: 'var(--max-content)',
            margin: '0 auto',
            padding: '0 var(--gutter-page)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
          }}
        >
          <Wordmark
            size="sm"
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin');
            }}
          />

          <Tabs
            fill
            tabs={[
              { value: '/admin', label: t('nav.myQuizzes') },
              { value: '/admin/sessions', label: t('nav.sessions') },
              // Every account reaches this page for its own password; only an ADMIN manages the
              // others there. Until the role is known the entry reads as the narrower « Mon compte ».
              {
                value: '/admin/admins',
                label: me?.role === 'ADMIN' ? t('nav.accounts') : t('nav.myAccount'),
              },
            ]}
            value={tabFor(pathname)}
            onChange={(value) => navigate(value)}
            aria-label={t('nav.label')}
            style={{ flex: 1, gap: 'var(--space-7)', borderBottom: 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {displayName && (
              <Badge tone="brand" icon="user">
                {displayName}
              </Badge>
            )}
            <LanguageSwitcher size="sm" />
            <Button variant="ghost" size="sm" icon="log-out" onClick={() => void logout()}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main
        style={{
          width: '100%',
          maxWidth: 'var(--max-content)',
          margin: '0 auto',
          padding: 'var(--space-9) var(--gutter-page)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-9)',
        }}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
