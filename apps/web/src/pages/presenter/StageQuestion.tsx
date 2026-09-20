// QUESTION_OPEN (plan § 5.2) — wording at 40–64 px, 148 px brand timer (red under 5 s), 2-column
// grid of neutral tiles (the letter is the only marker), and under it the full-width answer gauge
// « 18 / 24 ont répondu » that the presenter watches to decide when to close (§ 7-5).
// With an image, the column takes the whole stage height: wording at the top, answers and gauge at
// the bottom, the image in all the room between them.

import { useTranslation } from 'react-i18next';

import { CHOICE_LETTERS, type SnapshotQuestion } from '@quiz/shared';

import { AnswerOption, Button, ProgressBar, StageFrame, Timer } from '../../design-system/index.ts';
import { FillImage } from '../../features/shared-live/QuestionCard.tsx';
import { useCountdown } from '../../features/shared-live/useCountdown.ts';
import { mediaSrc } from '../../lib/media-src.ts';
import { NBSP } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import { Num } from '../participant/shells.tsx';
import {
  QuestionHead,
  SHORT_STAGE,
  StageBackButton,
  StageProgress,
  useFooterSlots,
  useStageKbd,
  useStageMainHeight,
} from './stage-shared.tsx';

export interface StageQuestionProps {
  view: SnapshotQuestion;
  index: number;
  total: number;
  /** Local epoch ms (clockOffset already applied) or null without a time limit. */
  closesAt: number | null;
  answered: number;
  connected: number;
  participants: number;
  onClose: () => void;
  /** Back to the previous result (← key); absent on the first question. */
  onBack?: () => void;
  onEnd: () => void;
}

export function StageQuestion({
  view,
  index,
  total,
  closesAt,
  answered,
  connected,
  participants,
  onClose,
  onBack,
  onEnd,
}: StageQuestionProps) {
  const { t } = useTranslation(['presenter', 'common']);
  const short = useMediaQuery(SHORT_STAGE);
  const mainHeight = useStageMainHeight();
  const image = view.media && view.media.kind === 'IMAGE' ? view.media : null;
  // Smaller tiles next to an image: every pixel they give back goes to the picture.
  const compactTiles = short || image !== null;
  const seconds = useCountdown(closesAt);
  const timeLimit = view.timeLimitSec ?? 0;
  const kbd = useStageKbd(t('question.kbd'));
  const slots = useFooterSlots(
    <StageProgress index={index} total={total} />,
    <span style={{ font: 'var(--text-body-lg)' }}>
      <Num style={{ color: 'var(--stage-ink)' }}>{connected}</Num>
      {NBSP}
      {t('common:units.connected', { count: connected })}
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
          {onBack && (
            <StageBackButton label={t('question.previousResult')} icon="arrow-left" onClick={onBack} />
          )}
          <Button size="xl" variant="inverse" icon="square" onClick={onClose}>
            {t('question.close')}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: short || image ? 'var(--space-6)' : 'var(--space-8)',
          height: image ? mainHeight : undefined,
        }}
      >
        <QuestionHead
          view={view}
          index={index}
          total={total}
          compact={short}
          hideImage={image !== null}
          aside={
            timeLimit > 0 && seconds !== null ? (
              <Timer
                size="lg"
                tone="inverse"
                seconds={seconds}
                total={timeLimit}
                aria-label={t('common:timer.remainingAria', { count: seconds })}
              />
            ) : undefined
          }
        />

        {image && <FillImage src={image.url} minHeight={120} />}

        {view.type === 'NUMERIC' || view.type === 'TEXT_POLL' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              minHeight: short ? 120 : 160,
              padding: 'var(--space-8)',
              background: 'var(--stage-panel)',
              border: '1px solid var(--stage-border)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}
          >
            {view.type === 'NUMERIC' ? (
              <>
                <h2>{t('question.numericTitle')}</h2>
                <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>
                  {t('question.numericHint')}
                </p>
              </>
            ) : (
              <>
                <h2>{t('question.textTitle')}</h2>
                <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>
                  {t('question.textHint')}
                </p>
              </>
            )}
          </div>
        ) : (
          <div
            role="list"
            aria-label={t('question.choicesLabel')}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: compactTiles ? 'var(--space-4)' : 'var(--space-5)',
            }}
          >
            {view.choices.map((choice, i) => (
              <div key={choice.id} role="listitem" style={{ minWidth: 0 }}>
                <AnswerOption
                  letter={CHOICE_LETTERS[i % CHOICE_LETTERS.length] ?? 'A'}
                  size={compactTiles ? 'md' : 'lg'}
                  // Display only: nobody answers from the stage — no hover lift, no focus stop.
                  disabled
                  tabIndex={-1}
                  aria-label={t('question.choiceAria', {
                    letter: CHOICE_LETTERS[i] ?? '',
                    label: choice.label,
                  })}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    {choice.media && choice.media.kind === 'IMAGE' && (
                      <img
                        src={mediaSrc(choice.media.url)}
                        alt=""
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover',
                          flex: '0 0 auto',
                        }}
                      />
                    )}
                    <span>{choice.label}</span>
                  </span>
                </AnswerOption>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p
            aria-live="polite"
            aria-atomic="true"
            style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}
          >
            <Num style={{ font: 'var(--text-numeric)', fontSize: 32 }}>
              {answered} / {participants}
            </Num>
            <span style={{ font: 'var(--text-body-lg)', fontSize: 22, color: 'var(--stage-ink-2)' }}>
              {t('question.answered')}
            </span>
          </p>
          <ProgressBar
            tone="inverse"
            size="lg"
            value={answered}
            max={Math.max(1, participants)}
            aria-hidden
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </StageFrame>
  );
}
