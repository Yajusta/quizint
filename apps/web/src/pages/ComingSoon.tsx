// Route `*` — fallback page. Reuses the foundations (`--surface-page` background, wordmark, `Button`),
// no aesthetic target of its own: the product's screens are the five surfaces of the plan.

import { useTranslation } from 'react-i18next';

import { Button, Wordmark } from '../design-system/index.ts';
import { Num } from './participant/shells.tsx';

export function ComingSoonPage() {
  const { t } = useTranslation('common');
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-10)',
        position: 'relative',
        overflow: 'hidden',
        padding: 'var(--space-10)',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
      }}
    >
      <Wordmark size="lg" />
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ marginBottom: 'var(--space-5)' }}>{t('comingSoon.title')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('comingSoon.body')}</p>
      </div>
      <Button variant="secondary" size="lg" disabled>
        {t('comingSoon.action')}
      </Button>
      <footer
        style={{
          position: 'absolute',
          bottom: 'var(--space-5)',
          left: 'var(--space-7)',
          font: 'var(--text-body-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {t('comingSoon.brand')} — <Num>2026</Num>
      </footer>
    </div>
  );
}
