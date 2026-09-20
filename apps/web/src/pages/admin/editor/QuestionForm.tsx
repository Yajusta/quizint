// Centre pane (plan § 5.3): « Informations » card (description, collapsed once filled), then the
// question form — type `Tabs`, prompt `Textarea` with auto-height and a 500 counter, propositions
// (`Radio` + `Input lg` + `IconButton trash-2`, max 6), true/false as two `AnswerOption`, numeric
// as value / tolerance / `Select` on one line. Validation errors sit under the block concerned.
// Green appears only on the correct answer (`Radio` checked, `AnswerOption state=correct`).

import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  CHOICE_LABEL_MAX_LENGTH,
  CHOICE_LETTERS,
  CHOICES_MAX,
  PROMPT_MAX_LENGTH,
  QUIZ_DESCRIPTION_MAX_LENGTH,
  TEXT_ANSWER_MAX_LENGTH,
  type QuestionType,
} from '@quiz/shared';

import {
  AnswerOption,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Radio,
  Select,
  Tabs,
  Textarea,
} from '../../../design-system/index.ts';
import { formatNumber, NBSP } from '../../../lib/format.ts';
import { Num } from '../AdminLayout.tsx';
import { BlockError, NumberInput } from './fields.tsx';
import {
  TYPE_ORDER,
  newChoice,
  switchType,
  type EditorChoice,
  type EditorQuestion,
  type Issue,
} from './model.ts';

// --- Informations ---------------------------------------------------------------------------

export interface InfoCardProps {
  description: string;
  onChange: (description: string) => void;
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}

/** Description of the quiz — expanded until it holds text, then a one-line summary. */
export function InfoCard(p: InfoCardProps) {
  const { t } = useTranslation('admin');
  if (p.collapsed) {
    return (
      <Card padding="sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ font: 'var(--text-label)', color: 'var(--text-secondary)', flex: '0 0 auto' }}>
            {t('editor.description')}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              font: 'var(--text-body-sm)',
              color: p.description ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.description || t('editor.descriptionEmpty')}
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            icon="pencil"
            label={t('editor.descriptionEdit')}
            onClick={() => p.onToggle(false)}
          />
        </div>
      </Card>
    );
  }
  return (
    <Card header={t('editor.info')}>
      <Field label={t('editor.description')} htmlFor="quiz-description" hint={t('editor.descriptionHint')}>
        <Textarea
          id="quiz-description"
          rows={2}
          value={p.description}
          maxLength={QUIZ_DESCRIPTION_MAX_LENGTH}
          placeholder={t('editor.descriptionPlaceholder')}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={() => {
            if (p.description.trim()) p.onToggle(true);
          }}
        />
      </Field>
    </Card>
  );
}

// --- Question -------------------------------------------------------------------------------

export interface QuestionFormProps {
  q: EditorQuestion;
  index: number;
  /** Frozen by a played session: type, propositions, correct answer and scoring are read-only. */
  locked: boolean;
  issues: Issue[];
  onChange: (next: EditorQuestion) => void;
}

export function QuestionForm({ q, index, locked, issues, onChange }: QuestionFormProps) {
  const { t } = useTranslation('admin');
  const issueFor = (path: Issue['path']): string | undefined => {
    const issue = issues.find((i) => i.path === path);
    return issue ? t(`validation.${issue.key}`, issue.values) : undefined;
  };
  const patch = (partial: Partial<EditorQuestion>) => onChange({ ...q, ...partial });
  const setChoices = (choices: EditorChoice[]) => patch({ choices });
  const promptId = `q-prompt-${q.key}`;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ font: 'var(--text-label)', color: 'var(--text-primary)' }}>
            {t('editor.questionLabel')}
            {NBSP}
            <Num>{index + 1}</Num>
          </span>
          <Tabs
            aria-label={t('editor.typeLabel')}
            tabs={TYPE_ORDER.map((type) => ({ value: type, label: t(`questionTypeShort.${type}`) }))}
            value={q.type}
            disabled={locked}
            onChange={(v) =>
              onChange(
                switchType(q, v as QuestionType, {
                  trueLabel: t('trueFalse.true'),
                  falseLabel: t('trueFalse.false'),
                }),
              )
            }
          />
        </div>

        <Field
          label={t('editor.prompt')}
          htmlFor={promptId}
          error={issueFor('prompt')}
          hint={
            <>
              <Num>{formatNumber(q.prompt.length)}</Num>
              {NBSP}/{NBSP}
              <Num>{formatNumber(PROMPT_MAX_LENGTH)}</Num>
            </>
          }
        >
          <AutoTextarea
            id={promptId}
            value={q.prompt}
            error={Boolean(issueFor('prompt'))}
            placeholder={t('editor.promptPlaceholder')}
            onChange={(v) => patch({ prompt: v.slice(0, PROMPT_MAX_LENGTH) })}
          />
        </Field>

        {q.type === 'TRUE_FALSE' && (
          <Block label={t('editor.correctAnswer')} error={issueFor('choices')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {q.choices.map((c, i) => (
                <AnswerOption
                  key={c.key}
                  letter={CHOICE_LETTERS[i] ?? 'A'}
                  size="md"
                  state={c.isCorrect ? 'correct' : 'default'}
                  aria-pressed={c.isCorrect}
                  disabled={locked}
                  onClick={() => setChoices(q.choices.map((cc, j) => ({ ...cc, isCorrect: j === i })))}
                  style={{ boxShadow: 'none' }}
                >
                  {c.label}
                </AnswerOption>
              ))}
            </div>
          </Block>
        )}

        {(q.type === 'MCQ' || q.type === 'POLL') && (
          <Block
            label={t('editor.choices')}
            hint={q.type === 'MCQ' ? t('editor.choicesHintMcq') : t('editor.choicesHintPoll')}
            error={issueFor('choices')}
          >
            <ol
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              {q.choices.map((c, i) => {
                const letter = CHOICE_LETTERS[i] ?? String(i + 1);
                return (
                  <li key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      aria-hidden
                      style={{
                        width: 18,
                        font: 'var(--text-code)',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}
                    >
                      {letter}
                    </span>
                    {q.type === 'MCQ' && (
                      <Radio
                        name={`correct-${q.key}`}
                        value={q.choices.find((cc) => cc.isCorrect)?.key ?? ''}
                        disabled={locked}
                        onChange={(key) =>
                          setChoices(q.choices.map((cc) => ({ ...cc, isCorrect: cc.key === key })))
                        }
                        options={[
                          {
                            value: c.key,
                            label: '',
                            ariaLabel: t('editor.choiceCorrectAria', { letter }),
                          },
                        ]}
                      />
                    )}
                    <Input
                      size="lg"
                      value={c.label}
                      disabled={locked}
                      aria-label={t('editor.choiceAria', { letter })}
                      placeholder={t('editor.choiceAria', { letter })}
                      maxLength={CHOICE_LABEL_MAX_LENGTH}
                      onChange={(e) =>
                        setChoices(
                          q.choices.map((cc, j) => (j === i ? { ...cc, label: e.target.value } : cc)),
                        )
                      }
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon="trash-2"
                      label={t('editor.choiceDelete', { letter })}
                      disabled={locked || q.choices.length <= 2}
                      onClick={() => setChoices(q.choices.filter((_, j) => j !== i))}
                    />
                  </li>
                );
              })}
            </ol>
            {q.choices.length < CHOICES_MAX && !locked && (
              <Button
                variant="ghost"
                size="sm"
                icon="plus"
                onClick={() => setChoices([...q.choices, newChoice()])}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('editor.addChoice')}
              </Button>
            )}
          </Block>
        )}

        {q.type === 'TEXT_POLL' && (
          <p style={{ margin: 0, font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
            <Trans
              i18nKey="editor.textPollHint"
              ns="admin"
              values={{ max: formatNumber(TEXT_ANSWER_MAX_LENGTH) }}
              components={{ num: <Num /> }}
            />
          </p>
        )}

        {q.type === 'NUMERIC' && (
          <Block label={t('editor.expectedAnswer')} error={issueFor('numericAnswer')}>
            <div
              style={{
                display: 'grid',
                // The `Select` needs room for « Pourcentage » plus its chevron in a 280 px column.
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr)',
                gap: 'var(--space-4)',
              }}
            >
              <Field label={t('editor.value')} htmlFor={`q-value-${q.key}`}>
                <NumberInput
                  id={`q-value-${q.key}`}
                  value={q.numericAnswer?.value ?? null}
                  disabled={locked}
                  error={Boolean(issueFor('numericAnswer'))}
                  onCommit={(n) =>
                    patch({
                      numericAnswer: {
                        value: n ?? 0,
                        tolerance: q.numericAnswer?.tolerance ?? 0,
                        toleranceMode: q.numericAnswer?.toleranceMode ?? 'ABSOLUTE',
                      },
                    })
                  }
                />
              </Field>
              <Field label={t('editor.tolerance')} htmlFor={`q-tol-${q.key}`}>
                <NumberInput
                  id={`q-tol-${q.key}`}
                  value={q.numericAnswer?.tolerance ?? 0}
                  disabled={locked}
                  onCommit={(n) =>
                    patch({
                      numericAnswer: {
                        value: q.numericAnswer?.value ?? 0,
                        tolerance: Math.max(0, n ?? 0),
                        toleranceMode: q.numericAnswer?.toleranceMode ?? 'ABSOLUTE',
                      },
                    })
                  }
                />
              </Field>
              <Field label={t('editor.mode')} htmlFor={`q-mode-${q.key}`}>
                <Select
                  id={`q-mode-${q.key}`}
                  value={q.numericAnswer?.toleranceMode ?? 'ABSOLUTE'}
                  disabled={locked}
                  options={[
                    { value: 'ABSOLUTE', label: t('editor.modeAbsolute') },
                    { value: 'PERCENT', label: t('editor.modePercent') },
                  ]}
                  onChange={(e) =>
                    patch({
                      numericAnswer: {
                        value: q.numericAnswer?.value ?? 0,
                        tolerance: q.numericAnswer?.tolerance ?? 0,
                        toleranceMode: e.target.value === 'PERCENT' ? 'PERCENT' : 'ABSOLUTE',
                      },
                    })
                  }
                />
              </Field>
            </div>
          </Block>
        )}
      </div>
    </Card>
  );
}

// --- Pieces -----------------------------------------------------------------------------------

/** Labelled block for a group of controls — a `Field` cannot wrap several inputs with one label. */
function Block({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span style={{ font: 'var(--text-label)', color: 'var(--text-primary)' }}>{label}</span>
        {hint && !error && (
          <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>{hint}</span>
        )}
      </div>
      {children}
      {error && <BlockError>{error}</BlockError>}
    </div>
  );
}

/** Kit `Textarea` that grows with its content (2 lines minimum) — no manual resize handle. */
function AutoTextarea({
  id,
  value,
  error,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  error: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Fit to content on every value change, and again when the column width changes (a height
  // computed at 1440 px would be too tall at 1024 px). Only width changes re-fit: reacting to
  // the element's own height would loop.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <Textarea
      ref={ref}
      id={id}
      rows={2}
      value={value}
      error={error}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ minHeight: 72, resize: 'none', overflow: 'hidden', font: 'var(--text-body-lg)' }}
    />
  );
}
