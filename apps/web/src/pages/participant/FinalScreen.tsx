// FINAL_RANKING (plan § 5.1 « Classement ») — hero card with the participant's own result, then the
// podium rows revealed in sequence. Stays on the stage ground until the session ends.

import { useTranslation } from 'react-i18next';

import type { ParticipantFinalView } from '@quiz/shared';

import { CountUp, LeaderboardRow } from '../../design-system/index.ts';
import { ordinalSuffix } from '../../lib/format.ts';
import { Overline, StageShell } from './shells.tsx';

export interface FinalScreenProps {
  final: ParticipantFinalView;
  nickname: string;
}

export function FinalScreen({ final: f, nickname }: FinalScreenProps) {
  const { t } = useTranslation(['participant', 'common']);
  return (
    <StageShell footer={<span>{t('final.footer')}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        <section
          aria-label={t('final.yourResult')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-7)',
            background: 'var(--stage-panel)',
            border: '1px solid var(--stage-border)',
            borderRadius: 'var(--radius-xl)',
            animation: 'qiRise var(--dur-slow) var(--ease-out) both',
          }}
        >
          <Overline tone="dark">{t('final.yourResult')}</Overline>
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ font: 'var(--text-numeric-xl)', letterSpacing: 'var(--tracking-tight)' }}>
              {f.yourRank}
              <span style={{ font: '600 28px/1 var(--font-display)', verticalAlign: 'top' }}>
                {ordinalSuffix(f.yourRank)}
              </span>
            </span>
            <span style={{ font: 'var(--text-numeric)', fontSize: 24, color: 'var(--stage-ink-2)' }}>
              / {f.participantCount}
            </span>
          </p>
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
            <CountUp value={f.yourScore} from={0} style={{ fontSize: 32 }} />
            <span style={{ font: 'var(--text-body-sm)', color: 'var(--stage-ink-2)' }}>
              {t('common:units.points')}
            </span>
          </p>
          <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)', overflowWrap: 'anywhere' }}>
            {nickname}
          </p>
        </section>

        {f.podium.length > 0 && (
          <section
            aria-label={t('final.podium')}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <h2>{t('final.podium')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {f.podium.map((p, i) => (
                <LeaderboardRow
                  // Tied rows share a rank; nicknames are unique per session.
                  key={p.nickname}
                  tone="dark"
                  rank={p.rank}
                  name={p.nickname}
                  score={p.score}
                  highlight={p.rank === f.yourRank && p.nickname === nickname}
                  style={{
                    animation: 'qiRise var(--dur-slow) var(--ease-out) both',
                    animationDelay: `${(i + 1) * 150}ms`,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </StageShell>
  );
}
