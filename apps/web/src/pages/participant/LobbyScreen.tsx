// LOBBY (plan § 5.1 « Attente ») — the participant is in the room: stage ground from now on.

import { useTranslation } from 'react-i18next';

import { PlayerChip, Wordmark } from '../../design-system/index.ts';
import { NBSP } from '../../lib/format.ts';
import { Num, StageShell } from './shells.tsx';

export interface LobbyScreenProps {
  nickname: string;
  quizTitle: string;
  totalQuestions: number;
  participantCount: number;
}

export function LobbyScreen({ nickname, quizTitle, totalQuestions, participantCount }: LobbyScreenProps) {
  const { t } = useTranslation(['participant', 'common']);
  return (
    <StageShell
      footer={
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          <span
            aria-live="polite"
            style={{ font: 'var(--text-numeric)', fontSize: 24, color: 'var(--stage-ink)' }}
          >
            {participantCount}
          </span>
          {NBSP}
          {t('common:units.participant', { count: participantCount })}
        </span>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-8)',
        }}
      >
        <Wordmark tone="dark" size="lg" />
        <PlayerChip
          name={nickname}
          tone="dark"
          style={{ animation: 'qiRise var(--dur-slow) var(--ease-out) both', maxWidth: '100%' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h1 style={{ textWrap: 'balance' }}>{t('lobby.title')}</h1>
          <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)', textWrap: 'balance' }}>
            {quizTitle}
            {totalQuestions > 0 && (
              <>
                {' · '}
                <Num>{totalQuestions}</Num>
                {NBSP}
                {t('common:units.question', { count: totalQuestions })}
              </>
            )}
          </p>
        </div>
        <p
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            font: 'var(--text-body-sm)',
            color: 'var(--stage-ink-2)',
          }}
        >
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
          {t('lobby.waiting')}
        </p>
      </div>
    </StageShell>
  );
}
