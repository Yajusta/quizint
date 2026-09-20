// FINAL_RANKING (plan § 5.2) — the podium is the moment of a live quiz (§ 7-2): revealed 3 → 2 → 1,
// scores counted up when each column lands, the rest of the ranking in compact rows underneath,
// six session figures on the right.

import { Trans, useTranslation } from 'react-i18next';

import type { FinalRankingView } from '@quiz/shared';

import {
  Button,
  LeaderboardRow,
  Podium,
  StageFrame,
  StatTile,
  type PodiumEntry,
} from '../../design-system/index.ts';
import { formatNumber, formatPercent, NBSP } from '../../lib/format.ts';
import { Num } from '../participant/shells.tsx';
import { StageBadge, useFooterSlots, useStageKbd, useStageMainHeight } from './stage-shared.tsx';

export interface StageFinalProps {
  final: FinalRankingView;
  onResults: () => void;
  onEnd: () => void;
  onRevealed?: () => void;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function StageFinal({ final: f, onResults, onEnd, onRevealed }: StageFinalProps) {
  const { t } = useTranslation(['presenter', 'common']);
  const mainHeight = useStageMainHeight();
  const s = f.stats;
  // Podium slots follow the ranking order (dense ranks can tie: the slot is the position, 1 to 3).
  const podium: PodiumEntry[] = f.ranking.slice(0, 3).map((p, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    name: p.nickname,
    score: p.score,
  }));
  const rest = f.ranking.slice(3);
  const participation = Math.round(s.averageParticipationRate * 100);
  const kbd = useStageKbd(t('final.kbd'));
  const slots = useFooterSlots(
    <StageBadge>{t('final.badge')}</StageBadge>,
    <span style={{ font: 'var(--text-body-lg)' }}>
      <Num style={{ color: 'var(--stage-ink)' }}>{s.totalParticipants}</Num>
      {NBSP}
      {t('common:units.participant', { count: s.totalParticipants })}
    </span>,
  );

  return (
    <StageFrame
      align="start"
      progress={slots.progress}
      status={slots.status}
      kbd={kbd}
      actions={
        <>
          <Button variant="inverse" size="lg" icon="download" onClick={onResults}>
            {t('final.results')}
          </Button>
          <Button size="xl" onClick={onEnd}>
            {t('final.end')}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(688px, 1fr) minmax(320px, 420px)',
          gap: 'var(--space-10)',
          alignItems: 'start',
          maxHeight: mainHeight,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
            minWidth: 0,
            maxHeight: mainHeight,
          }}
        >
          <h1 style={{ font: 'var(--text-display-2)', letterSpacing: 'var(--tracking-tight)' }}>
            {t('final.title')}
          </h1>
          {podium.length > 0 ? (
            <Podium entries={podium} onRevealed={onRevealed} />
          ) : (
            <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>{t('final.empty')}</p>
          )}
          {rest.length > 0 && (
            <ol
              aria-label={t('final.restLabel')}
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '0 var(--space-2) var(--space-2) 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              {rest.map((p) => (
                <li key={p.participantId}>
                  <LeaderboardRow
                    tone="dark"
                    rank={p.rank}
                    name={p.nickname}
                    score={p.score}
                    style={{ height: 48 }}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside
          aria-label={t('final.statsLabel')}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', minWidth: 0 }}
        >
          <StatTile
            tone="dark"
            icon="users"
            label={t('final.participants')}
            value={s.totalParticipants}
            unit={
              <Trans
                i18nKey="final.active"
                ns="presenter"
                count={s.activeParticipants}
                values={{ count: s.activeParticipants }}
                components={{ num: <Num /> }}
              />
            }
          />
          <StatTile
            tone="dark"
            icon="check"
            label={t('final.participation')}
            value={participation}
            unit="%"
          />
          <StatTile
            tone="dark"
            icon="bar-chart-3"
            label={t('final.averageScore')}
            value={formatNumber(Math.round(s.averageScore))}
          />
          <StatTile
            tone="dark"
            icon="timer"
            label={t('final.fastest')}
            value={s.fastestCorrect ? formatNumber(s.fastestCorrect.elapsedMs / 1000) : '—'}
            unit={s.fastestCorrect ? t('common:units.seconds') : undefined}
            trend={
              s.fastestCorrect ? (
                <>
                  {s.fastestCorrect.nickname} · <Num>Q{s.fastestCorrect.questionIndex + 1}</Num>
                </>
              ) : (
                t('final.noCorrect')
              )
            }
          />
          <StatTile
            tone="dark"
            icon="arrow-up"
            label={t('final.bestQuestion')}
            value={s.bestQuestion ? `Q${s.bestQuestion.questionIndex + 1}` : '—'}
            trend={
              s.bestQuestion ? (
                <>
                  <Num>{formatPercent(Math.round(s.bestQuestion.ratio * 100))}</Num>
                  {' · '}
                  {truncate(s.bestQuestion.prompt, 44)}
                </>
              ) : (
                t('final.noScoredQuestion')
              )
            }
          />
          <StatTile
            tone="dark"
            icon="arrow-down"
            label={t('final.worstQuestion')}
            value={s.worstQuestion ? `Q${s.worstQuestion.questionIndex + 1}` : '—'}
            trend={
              s.worstQuestion ? (
                <>
                  <Num>{formatPercent(Math.round(s.worstQuestion.ratio * 100))}</Num>
                  {' · '}
                  {truncate(s.worstQuestion.prompt, 44)}
                </>
              ) : (
                t('final.noScoredQuestion')
              )
            }
          />
        </aside>
      </div>
    </StageFrame>
  );
}
