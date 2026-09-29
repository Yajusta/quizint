// QUESTION_CLOSED (plan § 5.2) — the signature gesture of the stage (§ 3-2): the distribution bars
// push in 320 ms, one every 60 ms, from A to F. Green marks the correct tile, everything else is
// muted; a poll keeps every tile neutral. Numeric: histogram, expected value, median. Free-text poll:
// the grouped answers, most given first. The question's explanation, if any, spans the stage below.

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHOICE_LETTERS,
  toleranceBounds,
  type QuestionResultView,
  type SnapshotQuestion,
} from '@quiz/shared';

import {
  AnswerOption,
  Badge,
  Button,
  Icon,
  LeaderboardRow,
  CountUp,
  StageFrame,
  StatTile,
  Switch,
} from '../../design-system/index.ts';
import { Explanation } from '../../features/shared-live/Explanation.tsx';
import { TextAnswerList } from '../../features/shared-live/TextAnswerList.tsx';
import { formatDelta, formatNumber, formatTolerance, NBSP } from '../../lib/format.ts';
import { prefersReducedMotion, useMediaQuery } from '../../lib/useMediaQuery.ts';
import { Num } from '../participant/shells.tsx';
import {
  QuestionHead,
  ResultHead,
  SHORT_STAGE,
  StageBackButton,
  StageProgress,
  useFooterSlots,
  useStageKbd,
} from './stage-shared.tsx';

export interface StageClosedProps {
  /** Wording of the closed question (cached by the page; null after a reconnection). */
  view: SnapshotQuestion | null;
  result: QuestionResultView;
  index: number;
  total: number;
  isLast: boolean;
  showTop5: boolean;
  showNames: boolean;
  onShowNamesChange: (v: boolean) => void;
  onNext: () => void;
  /** Back to this question, reopened (← key); the page confirms first. */
  onReopen: () => void;
  onEnd: () => void;
}

const CASCADE_MS = 60;

/** Number of bars already pushed: one more every 60 ms (all at once under reduced motion). */
function useCascade(count: number, key: number): number {
  const [pushed, setPushed] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPushed(count);
      return undefined;
    }
    setPushed(0);
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setPushed(i + 1), 40 + i * CASCADE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [count, key]);
  return pushed;
}

export function StageClosed({
  view,
  result: r,
  index,
  total,
  isLast,
  showTop5,
  showNames,
  onShowNamesChange,
  onNext,
  onReopen,
  onEnd,
}: StageClosedProps) {
  const { t } = useTranslation(['presenter', 'common']);
  const short = useMediaQuery(SHORT_STAGE);
  const poll = r.correctAnswer === null;
  const hasNames = r.answers.length > 0;
  const kbd = useStageKbd(isLast ? t('closed.kbdRanking') : t('closed.kbdNext'));
  const slots = useFooterSlots(
    <StageProgress index={index} total={total} />,
    <span style={{ font: 'var(--text-body-lg)' }}>
      <Num style={{ color: 'var(--stage-ink)' }}>{r.answersCount}</Num>
      {NBSP}
      {t('common:units.answer', { count: r.answersCount })}
      {!poll && (
        <>
          {' · '}
          <Num style={{ color: 'var(--stage-ink)' }}>{r.correctCount}</Num>
          {NBSP}
          {t('common:units.correct', { count: r.correctCount })}
        </>
      )}
    </span>,
  );

  return (
    <StageFrame
      progress={slots.progress}
      status={slots.status}
      kbd={kbd}
      actions={
        <>
          <Button variant="inverse" size="lg" onClick={onEnd}>
            {t('stage.end')}
          </Button>
          <StageBackButton label={t('closed.back')} icon="arrow-left" onClick={onReopen} />
          <Button size="xl" iconRight="arrow-right" onClick={onNext}>
            {isLast ? t('closed.seeRanking') : t('closed.next')}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showTop5 ? 'minmax(0, 1fr) 400px' : 'minmax(0, 1fr)',
          columnGap: 'var(--space-10)',
          rowGap: short ? 'var(--space-6)' : 'var(--space-8)',
          alignItems: 'start',
        }}
      >
        {/* The question spans the stage; the answers and the top 5 share the row below; the
            explanation spans the last row. */}
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          {view ? (
            <QuestionHead view={view} index={index} total={total} compact />
          ) : (
            <ResultHead index={index} total={total} />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: short ? 'var(--space-6)' : 'var(--space-8)',
            minWidth: 0,
          }}
        >
          {r.distribution.kind === 'CHOICES' ? (
            <ChoicesReveal result={r} short={short} />
          ) : r.distribution.kind === 'TEXT' ? (
            // Scrolls on its own past half the stage: a full room can give hundreds of answers.
            <div style={{ maxHeight: short ? '40vh' : '50vh', overflowY: 'auto' }}>
              <TextAnswerList entries={r.distribution.entries} size="lg" />
            </div>
          ) : (
            <NumericReveal result={r} distribution={r.distribution} short={short} />
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-7)',
              flexWrap: 'wrap',
              minHeight: 40,
            }}
          >
            {r.fastestCorrect ? (
              <p
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  font: 'var(--text-body-lg)',
                  fontSize: 20,
                  color: 'var(--stage-ink-2)',
                }}
              >
                <Icon name="timer" size="lg" />
                {t('closed.fastest')}{' '}
                <span style={{ color: 'var(--stage-ink)', fontWeight: 600 }}>
                  {r.fastestCorrect.nickname}
                </span>
                {' — '}
                <Num style={{ color: 'var(--stage-ink)' }}>
                  {formatNumber(r.fastestCorrect.elapsedMs / 1000)}
                  {NBSP}
                  {t('common:units.seconds')}
                </Num>
              </p>
            ) : (
              <span />
            )}
            {hasNames && (
              <Switch
                checked={showNames}
                onChange={onShowNamesChange}
                label={t('closed.showNames')}
                style={{ font: 'var(--text-body-lg)' }}
              />
            )}
          </div>

          {showNames && hasNames && <NamesList result={r} />}
        </div>

        {showTop5 && (
          <aside
            aria-label={t('closed.top5Label')}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}
          >
            <h2>{t('closed.top5')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {r.top5.map((t, i) => (
                <LeaderboardRow
                  key={t.participantId}
                  tone="dark"
                  rank={t.rank}
                  name={t.nickname}
                  score={<CountUp value={t.score} from={0} />}
                  style={{
                    animation: 'qiRise var(--dur-slow) var(--ease-out) both',
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              ))}
            </div>
          </aside>
        )}

        {r.explanation && (
          <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <Explanation text={r.explanation} size="lg" />
          </div>
        )}
      </div>
    </StageFrame>
  );
}

// --- Choices ----------------------------------------------------------------------------------

function ChoicesReveal({ result: r, short }: { result: QuestionResultView; short: boolean }) {
  const { t } = useTranslation('presenter');
  const entries = r.distribution.kind === 'CHOICES' ? r.distribution.entries : [];
  const pushed = useCascade(entries.length, r.questionIndex);
  const correctId = r.correctAnswer && 'choiceId' in r.correctAnswer ? r.correctAnswer.choiceId : null;
  return (
    <div
      role="list"
      aria-label={t('closed.distributionLabel')}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: short ? 'var(--space-4)' : 'var(--space-5)',
      }}
    >
      {entries.map((e, i) => {
        const pct = r.answersCount > 0 ? Math.round((e.count / r.answersCount) * 100) : 0;
        const state = correctId === null ? 'default' : e.choiceId === correctId ? 'correct' : 'muted';
        return (
          <div key={e.choiceId} role="listitem" style={{ minWidth: 0 }}>
            <AnswerOption
              letter={CHOICE_LETTERS[i % CHOICE_LETTERS.length] ?? 'A'}
              size={short ? 'md' : 'lg'}
              state={state}
              distribution={pushed > i ? pct : 0}
              disabled
              tabIndex={-1}
              aria-label={`${t('closed.distributionAria', {
                letter: CHOICE_LETTERS[i] ?? '',
                label: e.label,
                percent: pct,
              })}${state === 'correct' ? t('closed.distributionAriaCorrect') : ''}`}
            >
              {e.label}
            </AnswerOption>
          </div>
        );
      })}
    </div>
  );
}

// --- Numeric ----------------------------------------------------------------------------------

type NumericDist = Extract<QuestionResultView['distribution'], { kind: 'NUMERIC' }>;

function NumericReveal({
  result: r,
  distribution: d,
  short,
}: {
  result: QuestionResultView;
  distribution: NumericDist;
  short: boolean;
}) {
  const { t } = useTranslation('presenter');
  const spec = r.correctAnswer && 'value' in r.correctAnswer ? r.correctAnswer : null;
  const { lo, hi } = toleranceBounds({
    value: d.expected,
    tolerance: spec?.tolerance ?? 0,
    toleranceMode: spec?.toleranceMode ?? 'ABSOLUTE',
  });
  const max = Math.max(1, ...d.buckets.map((b) => b.count));
  const pushed = useCascade(d.buckets.length, r.questionIndex);
  const barArea = short ? 180 : 260;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      {d.buckets.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-8)',
            background: 'var(--stage-panel)',
            border: '1px solid var(--stage-border)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <h2>{t('closed.noAnswers')}</h2>
        </div>
      ) : (
        <div
          role="img"
          aria-label={t('closed.histogramAria', {
            answers: r.answersCount,
            correct: d.correctCount,
          })}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-3)',
            padding: '0 var(--space-3)',
          }}
        >
          {d.buckets.map((b, i) => {
            const inRange = b.to >= lo && b.from <= hi;
            const h = pushed > i ? Math.max(6, Math.round((b.count / max) * barArea)) : 0;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <Num style={{ font: 'var(--text-numeric)', fontSize: 22, color: 'var(--stage-ink)' }}>
                  {b.count > 0 ? b.count : ''}
                </Num>
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    width: '100%',
                    height: h,
                    background: inRange ? 'var(--state-success)' : 'var(--gray-400)',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    transition: `height var(--dur-slow) var(--ease-out)`,
                  }}
                />
                <span
                  style={{
                    width: '100%',
                    borderTop: '1px solid var(--stage-border-strong)',
                    paddingTop: 'var(--space-2)',
                    textAlign: 'center',
                    font: 'var(--text-numeric)',
                    fontSize: 15,
                    color: 'var(--stage-ink-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatNumber(b.from)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}
      >
        <StatTile
          tone="dark"
          label={t('closed.expectedValue')}
          value={formatNumber(d.expected)}
          unit={
            spec && spec.tolerance > 0 ? (
              <Num>
                ±{NBSP}
                {formatTolerance(spec)}
              </Num>
            ) : undefined
          }
        />
        <StatTile
          tone="dark"
          label={t('closed.median')}
          value={d.median === null ? '—' : formatNumber(d.median)}
        />
        <StatTile
          tone="dark"
          label={t('closed.correctAnswers')}
          value={d.correctCount}
          unit={<Num>/ {r.answersCount}</Num>}
        />
      </div>
    </div>
  );
}

// --- Nominative answers ---------------------------------------------------------------------------

function NamesList({ result: r }: { result: QuestionResultView }) {
  const { t } = useTranslation('presenter');
  const labels = new Map(
    r.distribution.kind === 'CHOICES' ? r.distribution.entries.map((e) => [e.choiceId, e.label]) : [],
  );
  const poll = r.correctAnswer === null;
  const answerOf = (payload: QuestionResultView['answers'][number]['payload']): ReactNode =>
    'choiceId' in payload ? (
      (labels.get(payload.choiceId) ?? '—')
    ) : 'text' in payload ? (
      payload.text
    ) : (
      <Num>{formatNumber(payload.value)}</Num>
    );
  return (
    <ul
      aria-label={t('closed.namesLabel')}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxHeight: '22vh',
        overflowY: 'auto',
        paddingRight: 'var(--space-2)',
      }}
    >
      {r.answers.map((a) => (
        <li
          key={a.participantId}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, 2fr) auto auto',
            alignItems: 'center',
            gap: 'var(--space-5)',
            minHeight: 44,
            padding: '0 var(--space-5)',
            background: 'var(--stage-panel)',
            border: '1px solid var(--stage-border)',
            borderRadius: 'var(--radius-md)',
            font: 'var(--text-body-lg)',
          }}
        >
          <span
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            {a.nickname}
          </span>
          <span
            style={{
              color: 'var(--stage-ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {answerOf(a.payload)}
          </span>
          <span style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end' }}>
            {!poll && a.isCorrect !== null && (
              <Badge tone={a.isCorrect ? 'success' : 'danger'} icon={a.isCorrect ? 'check' : 'x'}>
                {a.isCorrect ? t('closed.correctBadge') : t('closed.wrongBadge')}
              </Badge>
            )}
          </span>
          <Num style={{ minWidth: 72, textAlign: 'right' }}>{poll ? '' : formatDelta(a.pointsAwarded)}</Num>
        </li>
      ))}
    </ul>
  );
}
