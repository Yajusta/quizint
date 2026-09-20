// Skeletons — pulse placeholders instead of bare text while data loads (plan § 12: « chargement
// sans skeleton » is a missing state). Two tones: `light` (app) and `dark` (stage).

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Wordmark } from '../design-system/index.ts';

type Tone = 'light' | 'dark';

function pulse(tone: Tone): CSSProperties {
  return {
    background: tone === 'dark' ? 'var(--stage-panel-2)' : 'var(--gray-100)',
    borderRadius: 'var(--radius-sm)',
    animation: 'qiPulse 1.4s ease-in-out infinite',
  };
}

/** Global keyframes live in styles.css (qiPulse). Row list skeleton. */
export function ListSkeleton({
  rows = 3,
  height = 56,
  tone = 'light',
}: {
  rows?: number;
  height?: number;
  tone?: Tone;
}) {
  const { t } = useTranslation('common');
  return (
    <div
      aria-busy="true"
      aria-label={t('skeleton.loading')}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ ...pulse(tone), height, borderRadius: 'var(--radius-md)' }} />
      ))}
    </div>
  );
}

/** Card-grid skeleton (dashboard quiz grid). */
export function GridSkeleton({ cards = 6 }: { cards?: number }) {
  const { t } = useTranslation('common');
  return (
    <div
      aria-busy="true"
      aria-label={t('skeleton.loading')}
      style={{
        display: 'grid',
        // Aligned on the « Mes quiz » grid: otherwise the skeleton does not have the same number of
        // columns as the list it announces, and the page jumps on load.
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--space-7)',
      }}
    >
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} style={{ ...pulse('light'), height: 120, borderRadius: 'var(--radius-lg)' }} />
      ))}
    </div>
  );
}

/** Presenter first screen (plan § 5.2 « Connexion »): stage ground, wordmark, quiz title, pulsing dot. */
export function PresenterSkeleton({ quizTitle }: { quizTitle?: string }) {
  const { t } = useTranslation('common');
  return (
    <div
      aria-busy="true"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-8)',
        padding: 'var(--space-10)',
        background: 'var(--stage-bg)',
        color: 'var(--stage-ink)',
      }}
    >
      <Wordmark tone="dark" size="lg" />
      {quizTitle ? (
        <h1
          style={{
            font: 'var(--text-question)',
            letterSpacing: 'var(--tracking-tight)',
            textAlign: 'center',
          }}
        >
          {quizTitle}
        </h1>
      ) : (
        <div
          style={{
            ...pulse('dark'),
            width: 'min(420px, 70vw)',
            height: 48,
            borderRadius: 'var(--radius-md)',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand-300)',
            animation: 'qiPulse 1.6s ease-in-out infinite',
          }}
        />
        <span style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>
          {t('skeleton.connecting')}
        </span>
      </div>
    </div>
  );
}

/** Inline small skeleton for a value. */
export function ValueSkeleton({
  width = 90,
  height = 28,
  tone = 'light',
  style,
}: {
  width?: number | string;
  height?: number;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return <span aria-hidden style={{ ...pulse(tone), display: 'inline-block', width, height, ...style }} />;
}
