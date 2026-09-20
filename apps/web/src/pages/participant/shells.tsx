// Participant shells (plan § 5.1) — two grounds and nothing else: the light app before the
// participant is registered, the stage once they are in the room. 24 px gutters (skill: participant
// single column), safe-area aware, no shadow, no blur. `StageFrame` is the projector's frame
// (80 px gutters, 88 px footer) and is deliberately not reused on a phone.

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../components/LanguageSwitcher.tsx';
import { Icon, Wordmark } from '../../design-system/index.ts';

const SIDE = 'var(--space-7)';

/** Light ground: wordmark top-left, content vertically centred, optional footer line. */
export function LightShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
        padding: `calc(var(--space-5) + env(safe-area-inset-top)) ${SIDE} calc(var(--space-7) + env(safe-area-inset-bottom))`,
      }}
    >
      {/* The picker lives on the light ground only: the journey starts and ends here, and a
          language change mid-question would reshuffle the screen being answered. */}
      <header
        style={{
          height: 'var(--control-h-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
        }}
      >
        <Wordmark size="md" />
        <LanguageSwitcher size="sm" />
      </header>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          padding: 'var(--space-8) 0',
        }}
      >
        {children}
      </main>
      {footer && (
        <footer style={{ display: 'flex', justifyContent: 'center', font: 'var(--text-body-sm)' }}>
          {footer}
        </footer>
      )}
    </div>
  );
}

/** Stage ground: the phone is a piece of the room. `padded=false` lets the child own its bar. */
export function StageShell({
  children,
  padded = true,
  align = 'center',
  footer,
  style,
}: {
  children: ReactNode;
  padded?: boolean;
  align?: 'center' | 'start';
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--stage-bg)',
        color: 'var(--stage-ink)',
        ...style,
      }}
    >
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: align === 'start' ? 'flex-start' : 'center',
          width: '100%',
          maxWidth: padded ? 480 : undefined,
          margin: '0 auto',
          padding: padded
            ? `calc(var(--space-8) + env(safe-area-inset-top)) ${SIDE} var(--space-7)`
            : `env(safe-area-inset-top) 0 0`,
        }}
      >
        {children}
      </main>
      {footer && (
        <footer
          style={{
            padding: `0 ${SIDE} calc(var(--space-7) + env(safe-area-inset-bottom))`,
            display: 'flex',
            justifyContent: 'center',
            textAlign: 'center',
            font: 'var(--text-body-sm)',
            color: 'var(--stage-ink-2)',
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}

/** Reconnection pill (§ 5.1) — drops from the top in 200 ms, announced as an alert. */
export function ReconnectBanner() {
  const { t } = useTranslation('common');
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        padding: `calc(var(--space-3) + env(safe-area-inset-top)) ${SIDE} 0`,
        pointerEvents: 'none',
        animation: 'qiDrop var(--dur-base) var(--ease-out) both',
      }}
    >
      <span
        role="alert"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          height: 'var(--control-h-md)',
          padding: `0 var(--space-5)`,
          borderRadius: 'var(--radius-full)',
          background: 'var(--state-danger)',
          color: 'var(--text-inverse)',
          font: 'var(--text-label)',
          boxShadow: 'var(--shadow-2)',
        }}
      >
        <Icon name="wifi-off" size="sm" />
        {t('reconnecting')}
      </span>
    </div>
  );
}

/**
 * Digits inside running text — every number renders in mono (skill: « numbers are content »).
 * `children` is optional: `<Trans components={{ num: <Num /> }}>` clones the element without any,
 * then fills it with the part of the sentence the dictionary wrapped in `<num>`.
 */
export function Num({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, ...style }}>{children}</span>;
}

/** Overline — the only uppercase allowed (skill), used for micro-context above a block. */
export function Overline({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p
      style={{
        font: 'var(--text-overline)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color: tone === 'dark' ? 'var(--stage-ink-2)' : 'var(--text-muted)',
      }}
    >
      {children}
    </p>
  );
}
