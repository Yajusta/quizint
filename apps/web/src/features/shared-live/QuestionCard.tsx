// QuestionCard (plan § 5.4, shared with the editor preview): renders a question exactly as a
// participant sees it — always on the stage ground, so the editor preview is faithful.
// Contract kept: `view`, `closesAt`, `onSubmit`, `preview`; `index` / `total` feed the top bar.
//
// Signature gesture (§ 3-2): the tapped tile fills with brand instantly, the others fade in 120 ms,
// the phone vibrates 10 ms, the answer is sent; the ack turns the letter into a check and shows
// « Réponse enregistrée » under the list — the screen is never replaced.
//
// With an image, the prompt sits at the top, the answers at the bottom and the image takes all the
// room between them.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHOICE_LETTERS,
  NUMERIC_INPUT_MAX_LENGTH,
  TEXT_ANSWER_MAX_LENGTH,
  type AnswerSubmission,
  type ParticipantQuestionView,
} from '@quiz/shared';

import {
  AnswerOption,
  Badge,
  Button,
  Icon,
  Input,
  ProgressBar,
  Textarea,
  Timer,
} from '../../design-system/index.ts';
import { formatNumber, NBSP } from '../../lib/format.ts';
import { mediaSrc } from '../../lib/media-src.ts';
import { useCountdown } from './useCountdown.ts';
import { ZoomImage } from './ZoomImage.tsx';

export interface QuestionCardProps {
  view: ParticipantQuestionView;
  /** Countdown target (server epoch ms) — the store's clockOffset must be applied by the caller. */
  closesAt: number | null;
  /** 0-based question index and total, for the top progress bar. */
  index?: number;
  total?: number;
  alreadyAnswered?: boolean;
  /** Choice recorded before a reconnection: shown selected and checked. */
  answeredChoiceId?: string | null;
  /** Free text recorded before a reconnection (TEXT_POLL): shown read-only. */
  answeredText?: string | null;
  disabled?: boolean;
  onSubmit?: (answer: AnswerSubmission) => Promise<{ ok: boolean; code?: string } | void>;
  /** Editor preview mode: no answering, static timer. */
  preview?: boolean;
}

type Status = 'idle' | 'sending' | 'recorded';

const SIDE = 'var(--space-7)';

function vibrate() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
  } catch {
    // vibration unavailable — the visual gesture is enough
  }
}

export function QuestionCard({
  view,
  closesAt,
  index,
  total,
  alreadyAnswered = false,
  answeredChoiceId = null,
  answeredText = null,
  disabled = false,
  onSubmit,
  preview = false,
}: QuestionCardProps) {
  const { t } = useTranslation('common');
  const remainingSec = useCountdown(closesAt, !preview);
  const [status, setStatus] = useState<Status>(alreadyAnswered ? 'recorded' : 'idle');
  const [selected, setSelected] = useState<string | null>(alreadyAnswered ? answeredChoiceId : null);
  const [error, setError] = useState<string | null>(null);
  const [numericValue, setNumericValue] = useState('');
  const [textValue, setTextValue] = useState(alreadyAnswered ? (answeredText ?? '') : '');

  useEffect(() => {
    setStatus(alreadyAnswered ? 'recorded' : 'idle');
    setSelected(alreadyAnswered ? answeredChoiceId : null);
    if (alreadyAnswered && answeredText !== null) setTextValue(answeredText);
    setError(null);
  }, [alreadyAnswered, answeredChoiceId, answeredText, view.id]);

  const locked = disabled || preview || status !== 'idle';

  const send = async (answer: AnswerSubmission) => {
    setStatus('sending');
    setError(null);
    const result = await onSubmit?.(answer);
    if (!result || result.ok || result.code === 'ALREADY_ANSWERED') {
      setStatus('recorded');
      return;
    }
    setStatus('idle');
    setSelected(null);
    setError(
      result.code === 'QUESTION_CLOSED'
        ? t('card.errorClosed')
        : result.code === 'INVALID_TEXT'
          ? t('card.errorTooLong', { max: TEXT_ANSWER_MAX_LENGTH })
          : t('card.errorGeneric'),
    );
  };

  const pickChoice = (choiceId: string) => {
    if (locked) return;
    setSelected(choiceId);
    vibrate();
    void send({ choiceId });
  };

  const submitNumeric = () => {
    if (locked || numericValue.length === 0) return;
    vibrate();
    void send({ value: numericValue });
  };

  const trimmedText = textValue.trim();
  const submitText = () => {
    if (locked || trimmedText.length === 0) return;
    vibrate();
    void send({ text: trimmedText });
  };

  const timeLimit = view.timeLimitSec ?? 0;
  const showTimer = timeLimit > 0 && (preview || remainingSec !== null);
  const showProgress = index !== undefined && total !== undefined && total > 0;
  const hasBar = showTimer || showProgress;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: '100%',
        width: '100%',
        background: 'var(--stage-bg)',
        color: 'var(--stage-ink)',
      }}
    >
      {hasBar && (
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--stage-bg)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-5)',
              minHeight: showTimer ? 72 : 48,
              padding: `var(--space-3) ${SIDE}`,
              background: 'var(--stage-panel)',
              borderBottom: '1px solid var(--stage-border)',
            }}
          >
            {showProgress ? (
              <ProgressBar
                tone="inverse"
                size="sm"
                value={(index ?? 0) + 1}
                max={total}
                aria-label={t('question.progressAria', { current: (index ?? 0) + 1, total })}
                style={{ flex: 1 }}
              />
            ) : (
              <span style={{ flex: 1 }} />
            )}
            {showTimer && (
              <Timer
                size="sm"
                tone="inverse"
                seconds={preview ? timeLimit : (remainingSec ?? 0)}
                total={timeLimit}
                aria-label={t('timer.remainingAria', {
                  count: preview ? timeLimit : (remainingSec ?? 0),
                })}
              />
            )}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
          padding: `var(--space-7) ${SIDE} calc(var(--space-7) + env(safe-area-inset-bottom))`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p
            style={{
              font: 'var(--text-overline)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--stage-ink-2)',
              display: 'flex',
              gap: 'var(--space-2)',
            }}
          >
            {showProgress && (
              <>
                <span>{t('question.label')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {(index ?? 0) + 1} / {total}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{t(`questionType.${view.type}`)}</span>
          </p>
          <h2
            style={{
              // 28 px display (§ 5.1); a long prompt steps down to 24 px to stay readable at a glance.
              font:
                view.prompt.length > 80
                  ? '600 24px/1.25 var(--font-display)'
                  : '600 28px/1.2 var(--font-display)',
              letterSpacing: 'var(--tracking-tight)',
              textWrap: 'pretty',
              overflowWrap: 'anywhere',
            }}
          >
            {view.prompt}
          </h2>
        </div>

        <QuestionMedia media={view.media} />

        {view.type === 'TEXT_POLL' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="text-answer" style={{ font: 'var(--text-label)', color: 'var(--stage-ink-2)' }}>
                {t('card.yourAnswer')}
              </label>
              <span aria-hidden style={{ font: 'var(--text-code)', color: 'var(--stage-ink-2)' }}>
                {formatNumber(textValue.length)}
                {NBSP}/{NBSP}
                {formatNumber(TEXT_ANSWER_MAX_LENGTH)}
              </span>
            </div>
            <Textarea
              id="text-answer"
              rows={3}
              maxLength={TEXT_ANSWER_MAX_LENGTH}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={t('card.textPlaceholder')}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value.replace(/[\r\n]+/g, ' '))}
              onKeyDown={(e) => {
                // One line of text: Enter sends, it never inserts a line break.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitText();
                }
              }}
              disabled={disabled || preview}
              readOnly={status !== 'idle'}
              aria-readonly={status !== 'idle'}
              style={{ fontSize: 20, lineHeight: 1.4, resize: 'none' }}
            />
            <SubmitRow
              status={status}
              error={error}
              onSubmit={submitText}
              disabled={disabled || preview || trimmedText.length === 0}
            />
          </div>
        ) : view.type === 'NUMERIC' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <label
              htmlFor="numeric-answer"
              style={{ font: 'var(--text-label)', color: 'var(--stage-ink-2)' }}
            >
              {t('card.yourAnswer')}
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              {/* No inputMode="decimal": the iOS decimal pad has no « - » key. The text keyboard has
                  it in its digit row, so a negative value can be typed directly. */}
              <Input
                id="numeric-answer"
                size="xl"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                value={numericValue}
                onChange={(e) =>
                  setNumericValue(e.target.value.replace(/\s/g, '').slice(0, NUMERIC_INPUT_MAX_LENGTH))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNumeric();
                }}
                // Recorded answer stays legible (read-only), disabled is for preview / caller lock.
                disabled={disabled || preview}
                readOnly={status !== 'idle'}
                aria-readonly={status !== 'idle'}
                aria-label={t('card.yourNumericAnswer')}
                style={{ font: 'var(--text-numeric)', fontSize: 28, textAlign: 'center' }}
              />
            </div>
            <SubmitRow
              status={status}
              error={error}
              onSubmit={submitNumeric}
              disabled={disabled || preview || numericValue.length === 0}
            />
          </div>
        ) : (
          <>
            <div
              role="group"
              aria-label={t('card.choicesGroup')}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              {view.choices.map((choice, i) => {
                const letter = CHOICE_LETTERS[i % CHOICE_LETTERS.length] ?? 'A';
                const isSelected = selected === choice.id;
                const state = isSelected ? 'selected' : selected !== null ? 'muted' : 'default';
                return (
                  <AnswerOption
                    key={choice.id}
                    letter={letter}
                    state={state}
                    // Two propositions (true/false): 96 px tiles — two large buttons, a less hollow screen.
                    size={view.choices.length === 2 ? 'lg' : 'md'}
                    check={isSelected && status === 'recorded'}
                    disabled={!preview && (disabled || (selected !== null && !isSelected))}
                    onClick={preview ? undefined : () => pickChoice(choice.id)}
                    aria-label={t('card.choiceAria', { letter, label: choice.label })}
                    aria-pressed={isSelected}
                    style={{
                      minHeight: view.choices.length === 2 ? 96 : 64,
                      // 120 ms: the tapped tile fills instantly, the others go quiet (§ 3-2).
                      transition:
                        'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      {choice.media && choice.media.kind === 'IMAGE' && (
                        <img
                          src={mediaSrc(choice.media.url)}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-sm)',
                            objectFit: 'cover',
                            flex: '0 0 auto',
                          }}
                        />
                      )}
                      <span>{choice.label}</span>
                    </span>
                  </AnswerOption>
                );
              })}
            </div>
            <StatusRow status={status} error={error} />
          </>
        )}
      </div>
    </div>
  );
}

/** Submit button of a typed answer (number, free text): it gives way to the feedback once recorded. */
function SubmitRow({
  status,
  error,
  onSubmit,
  disabled,
}: {
  status: Status;
  error: string | null;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation('common');
  if (status === 'recorded') return <StatusRow status={status} error={null} />;
  return (
    <>
      <Button size="xl" block onClick={onSubmit} disabled={disabled} loading={status === 'sending'}>
        {t('actions.submit')}
      </Button>
      <StatusRow status={status} error={error} />
    </>
  );
}

/** Feedback line under the answers — reserved height so the list never jumps. */
function StatusRow({ status, error }: { status: Status; error: string | null }) {
  const { t } = useTranslation('common');
  return (
    <div
      aria-live="polite"
      style={{ minHeight: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      {status === 'recorded' && (
        <Badge tone="success" dot>
          {t('card.recorded')}
        </Badge>
      )}
      {error && (
        <Badge tone="danger" role="alert">
          {error}
        </Badge>
      )}
    </div>
  );
}

function QuestionMedia({ media }: { media: ParticipantQuestionView['media'] }) {
  const { t } = useTranslation('common');
  if (!media) return null;
  if ('hidden' in media) {
    return (
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-5)',
          background: 'var(--stage-panel)',
          border: '1px solid var(--stage-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--stage-ink-2)',
          font: 'var(--text-body)',
        }}
      >
        <Icon name="eye" size="lg" />
        {media.kind === 'AUDIO' ? t('card.hiddenAudio') : t('card.hiddenImage')}
      </p>
    );
  }
  if (media.kind === 'IMAGE') return <FillImage src={media.url} minHeight={160} />;
  return <audio controls src={mediaSrc(media.url)} style={{ width: '100%' }} preload="none" />;
}

/**
 * Image filling the room its flex parent leaves between the prompt and the answers: the box grows,
 * the picture is laid absolutely inside it so its own size never pushes the answers off screen.
 * Shared with the stage, where the same rule applies. A click shows it full screen.
 */
export function FillImage({ src, minHeight }: { src: string; minHeight: number }) {
  return (
    <div style={{ position: 'relative', flex: '1 1 0', minHeight }}>
      <ZoomImage src={src} fill />
    </div>
  );
}
