// QUESTION_CLOSED (plan § 5.1 « Retour ») — the score delta is the n° 1 information: 72 px mono,
// counted up in 600 ms. Colour appears only here: green / red circle at the reveal. The question's
// explanation, if any, closes the screen under the score and rank.

import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { ParticipantRoundResult } from '@quiz/shared';

import { CountUp, Icon, StatTile } from '../../design-system/index.ts';
import { Explanation } from '../../features/shared-live/Explanation.tsx';
import { TextAnswerList } from '../../features/shared-live/TextAnswerList.tsx';
import { formatDelta, formatNumber, formatTolerance, MINUS, NBSP } from '../../lib/format.ts';
import { Num, StageShell } from './shells.tsx';

export interface RoundResultScreenProps {
  result: ParticipantRoundResult;
}

type Verdict = 'correct' | 'wrong' | 'none' | 'poll';

function verdictOf(r: ParticipantRoundResult): Verdict {
  // A poll has no correct answer; a scored question without an answer has isCorrect null too.
  if (r.correctAnswer === null) return 'poll';
  if (r.isCorrect === null || r.yourAnswer === null) return 'none';
  return r.isCorrect ? 'correct' : 'wrong';
}

const TITLE_KEYS: Record<Verdict, string> = {
  correct: 'roundResult.titleCorrect',
  wrong: 'roundResult.titleWrong',
  none: 'roundResult.titleNone',
  poll: 'roundResult.titlePoll',
};

export function RoundResultScreen({ result: r }: RoundResultScreenProps) {
  const { t } = useTranslation('participant');
  const verdict = verdictOf(r);
  const circle =
    verdict === 'correct'
      ? { bg: 'var(--state-success)', ink: 'var(--white)', icon: 'check', border: 'transparent' }
      : verdict === 'wrong'
        ? { bg: 'var(--state-danger)', ink: 'var(--white)', icon: 'x', border: 'transparent' }
        : {
            bg: 'var(--stage-panel)',
            ink: 'var(--stage-ink)',
            // Poll: the opinion was recorded (check) ; no answer: nothing to record (minus).
            icon: verdict === 'poll' ? 'check' : 'minus',
            border: 'var(--stage-border-2)',
          };
  const expected = expectedLabel(r.correctAnswer);
  const previousScore = r.totalScore - r.pointsAwarded;

  return (
    <StageShell footer={<span>{t('roundResult.footerNext')}</span>}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-8)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 88,
            height: 88,
            borderRadius: 'var(--radius-full)',
            background: circle.bg,
            color: circle.ink,
            border: `1px solid ${circle.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'qiRise var(--dur-slow) var(--ease-out) both',
          }}
        >
          <Icon name={circle.icon} size={44} strokeWidth={2} />
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h1
            style={{
              font: '700 40px/1.06 var(--font-display)',
              letterSpacing: 'var(--tracking-tight)',
              textWrap: 'balance',
            }}
          >
            {t(TITLE_KEYS[verdict])}
          </h1>
          {expected && (
            <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)', overflowWrap: 'anywhere' }}>
              {t('roundResult.expectedLabel')} {expected}
            </p>
          )}
        </div>

        {r.textEntries !== null && <TextAnswerList entries={r.textEntries} />}

        {verdict !== 'poll' && r.pointsAwarded !== 0 && (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}
          >
            {/* Sign as its own glyph (a mono space at 72 px would be a 43 px hole), value counted up. */}
            <p
              aria-label={formatDelta(r.pointsAwarded)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-4)',
                font: 'var(--text-numeric-xl)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--stage-ink)',
              }}
            >
              <span aria-hidden style={{ color: 'var(--stage-ink-2)' }}>
                {r.pointsAwarded > 0 ? '+' : MINUS}
              </span>
              <CountUp value={Math.abs(r.pointsAwarded)} from={0} style={{ font: 'inherit' }} />
            </p>
            {r.pointsBonus > 0 && (
              <p style={{ font: 'var(--text-body-sm)', color: 'var(--stage-ink-2)' }}>
                <Trans
                  i18nKey="roundResult.speedBonus"
                  ns="participant"
                  values={{ points: formatNumber(r.pointsBonus) }}
                  components={{ num: <Num /> }}
                />
              </p>
            )}
          </div>
        )}

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', width: '100%' }}
        >
          <StatTile
            tone="dark"
            label={t('roundResult.score')}
            value={<CountUp value={r.totalScore} from={previousScore} style={{ fontSize: 32 }} />}
            style={{ textAlign: 'left' }}
          />
          <StatTile
            tone="dark"
            label={t('roundResult.rank')}
            value={r.rank}
            unit={<Num>/ {r.participantCount}</Num>}
            style={{ textAlign: 'left' }}
          />
        </div>

        {r.explanation && <Explanation text={r.explanation} />}
      </div>
    </StageShell>
  );
}

/** QUESTION_CLOSED before the individual result arrives (same ground, no flash). */
export function RoundClosedScreen({
  title,
  footer,
}: {
  /** Dictionary key in the `participant` namespace; the defaults are the closed-question wording. */
  title?: string;
  footer?: string;
}) {
  const { t } = useTranslation('participant');
  return (
    <StageShell footer={<span>{t(footer ?? 'roundResult.closedFooter')}</span>}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h1 style={{ textWrap: 'balance' }}>{t(title ?? 'roundResult.closedTitle')}</h1>
      </div>
    </StageShell>
  );
}

function expectedLabel(ca: ParticipantRoundResult['correctAnswer']): ReactNode {
  if (!ca) return null;
  if ('label' in ca) return ca.label;
  return (
    <Num>
      {formatNumber(ca.value)}
      {ca.tolerance > 0 && ` (±${NBSP}${formatTolerance(ca)})`}
    </Num>
  );
}
