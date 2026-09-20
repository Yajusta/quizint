// ENDED (plan § 5.2) — the session is over: stage empty state and the way back to the history.

import { useTranslation } from 'react-i18next';

import { Button, EmptyState, StageFrame } from '../../design-system/index.ts';

export function StageEnded({ onHistory }: { onHistory: () => void }) {
  const { t } = useTranslation('presenter');
  return (
    <StageFrame>
      <EmptyState
        tone="dark"
        icon="square"
        title={
          <span style={{ font: 'var(--text-question)', letterSpacing: 'var(--tracking-tight)' }}>
            {t('ended.title')}
          </span>
        }
        description={<span style={{ font: 'var(--text-body-lg)' }}>{t('ended.description')}</span>}
        action={
          <Button variant="inverse" size="lg" icon="history" onClick={onHistory}>
            {t('ended.history')}
          </Button>
        }
      />
    </StageFrame>
  );
}
