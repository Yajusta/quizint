// « Détail de session » (plan § 5.3): four tiles, ranking, one card per question.
// Same reading of the results as the stage — `AnswerOption state=correct|muted distribution`.
// The CSV exports (opening the URL signed by the cookie) are unchanged.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { z } from 'zod';

import {
  CHOICE_LETTERS,
  toleranceBounds,
  type NumericDistPayload,
  type QuestionDistribution,
} from '@quiz/shared';

import { apiJson, apiPath } from '../../lib/api-client.ts';
import { formatDate, formatNumber, NBSP } from '../../lib/format.ts';
import {
  AnswerOption,
  Button,
  Card,
  EmptyState,
  LeaderboardRow,
  StatTile,
  Tag,
} from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, SectionTitle } from './AdminLayout.tsx';
import { playedMinutes } from './session-list.ts';

const SessionDetailSchema = z.object({
  session: z.object({
    id: z.string(),
    code: z.string(),
    phase: z.string(),
    startedAt: z.number().nullable(),
    endedAt: z.number().nullable(),
    createdAt: z.number(),
    participants: z.array(
      z.object({
        id: z.string(),
        nickname: z.string(),
        score: z.number(),
        isKicked: z.boolean(),
        joinedAt: z.number(),
      }),
    ),
    /** Computed server-side with the shared `buildRanking`: the stage and the CSV agree with it. */
    ranking: z.array(
      z.object({ participantId: z.string(), nickname: z.string(), score: z.number(), rank: z.number() }),
    ),
    questionResults: z.array(
      z.object({
        questionIndex: z.number(),
        answersCount: z.number(),
        correctCount: z.number(),
        distribution: z.unknown(),
        fastestCorrect: z
          .object({ participantId: z.string(), nickname: z.string(), elapsedMs: z.number() })
          .nullable(),
      }),
    ),
    quizSnapshot: z.object({
      title: z.string(),
      questions: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          prompt: z.string(),
          choices: z.array(z.object({ id: z.string(), label: z.string(), isCorrect: z.boolean() })),
          numericAnswer: z
            .object({
              value: z.number(),
              tolerance: z.number(),
              toleranceMode: z.enum(['ABSOLUTE', 'PERCENT']).default('ABSOLUTE'),
            })
            .nullable(),
        }),
      ),
    }),
  }),
});

type Detail = z.infer<typeof SessionDetailSchema>;
type QuestionResult = Detail['session']['questionResults'][number];
type Question = Detail['session']['quizSnapshot']['questions'][number];

/** Shapes persisted by `SessionManager` in `questionResult.distribution`. */
function distributionOf<K extends QuestionDistribution['kind']>(
  d: unknown,
  kind: K,
): Extract<QuestionDistribution, { kind: K }> | null {
  const v = d as { kind?: string } | null;
  return v && v.kind === kind ? (v as Extract<QuestionDistribution, { kind: K }>) : null;
}

/** `6,4` — an answer duration in seconds, one decimal. */
function seconds(ms: number): string {
  return formatNumber(Math.round(ms / 100) / 10);
}

export function SessionDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson
      .get(apiPath`/sessions/${id}`, SessionDetailSchema)
      .then(setData)
      .catch((e) => {
        if (!redirectIfUnauthorized(e, navigate)) setError(t('sessionDetail.notFound'));
      });
  }, [id, navigate, t]);

  const exportCsv = (kind: 'scores' | 'answers') => {
    window.open(apiPath`/api/v1/sessions/${id}/export.csv?kind=${kind}`, '_blank');
  };

  if (error) {
    return (
      <AdminLayout>
        <ErrorAlert>{error}</ErrorAlert>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout>
        <ListSkeleton rows={4} />
      </AdminLayout>
    );
  }

  const { session } = data;
  const players = session.participants.filter((p) => !p.isKicked);
  const ranking = session.ranking;

  // Polls have no right answer: like the shared final stats, they stay out of the success rate.
  const scored = session.questionResults.filter((r) => {
    const type = session.quizSnapshot.questions[r.questionIndex]?.type;
    return type !== 'POLL' && type !== 'TEXT_POLL';
  });
  const answered = scored.reduce((n, r) => n + r.answersCount, 0);
  const correct = scored.reduce((n, r) => n + r.correctCount, 0);
  const successRate = answered > 0 ? Math.round((correct / answered) * 100) : null;
  const averageScore =
    players.length > 0 ? Math.round(players.reduce((n, p) => n + p.score, 0) / players.length) : 0;
  const fastest = session.questionResults
    .map((r) => r.fastestCorrect)
    .filter((f): f is NonNullable<QuestionResult['fastestCorrect']> => f !== null)
    .sort((a, b) => a.elapsedMs - b.elapsedMs)[0];

  const durationMin = playedMinutes(session);

  return (
    <AdminLayout>
      <PageHeader
        title={session.quizSnapshot.title}
        subtitle={
          <>
            <Num>{formatDate(session.createdAt)}</Num> · {t('sessionDetail.code')}
            {NBSP}
            <Num>{session.code}</Num>
            {durationMin !== null && (
              <>
                {' · '}
                <Num>{formatNumber(durationMin)}</Num>
                {NBSP}
                {t('units.minutes')}
              </>
            )}
          </>
        }
        actions={
          <>
            <Button icon="download" onClick={() => exportCsv('scores')}>
              {t('sessionDetail.exportScores')}
            </Button>
            <Button variant="secondary" icon="download" onClick={() => exportCsv('answers')}>
              {t('sessionDetail.exportAnswers')}
            </Button>
          </>
        }
      />

      <section
        aria-label={t('sessionDetail.statsLabel')}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <StatTile icon="users" label={t('sessionDetail.participants')} value={formatNumber(players.length)} />
        <StatTile
          icon="bar-chart-3"
          label={t('sessionDetail.successRate')}
          value={successRate === null ? '—' : formatNumber(successRate)}
          unit={successRate === null ? undefined : '%'}
        />
        <StatTile icon="trophy" label={t('sessionDetail.averageScore')} value={formatNumber(averageScore)} />
        <StatTile
          icon="timer"
          label={t('sessionDetail.fastest')}
          value={fastest ? seconds(fastest.elapsedMs) : '—'}
          unit={fastest ? t('common:units.seconds') : undefined}
          trend={fastest?.nickname}
        />
      </section>

      <section
        aria-label={t('sessionDetail.rankingLabel')}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <SectionTitle>{t('sessionDetail.ranking')}</SectionTitle>
        {ranking.length === 0 ? (
          <EmptyState
            icon="user"
            title={t('sessionDetail.emptyRankingTitle')}
            description={t('sessionDetail.emptyRankingDescription')}
          />
        ) : (
          // 8 px between rows: a ranking reads as one block, not as cards.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {ranking.map((p, i) => (
              <LeaderboardRow
                key={p.participantId}
                rank={p.rank}
                name={p.nickname}
                score={p.score}
                style={riseStyle(i)}
              />
            ))}
          </div>
        )}
      </section>

      <section
        aria-label={t('sessionDetail.questionsLabel')}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
      >
        <SectionTitle>{t('sessionDetail.questions')}</SectionTitle>
        {session.quizSnapshot.questions.map((q, i) => (
          <QuestionCardResult
            key={q.id}
            question={q}
            index={i}
            result={session.questionResults.find((r) => r.questionIndex === i)}
          />
        ))}
      </section>
    </AdminLayout>
  );
}

function QuestionCardResult({
  question,
  index,
  result,
}: {
  question: Question;
  index: number;
  result: QuestionResult | undefined;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const total = result?.answersCount ?? 0;
  const correct = result?.correctCount ?? 0;
  const choices = distributionOf(result?.distribution, 'CHOICES');
  const numeric = distributionOf(result?.distribution, 'NUMERIC');
  const text = distributionOf(result?.distribution, 'TEXT');
  // A poll has no correct answer: no success count, no « correcte » proposition.
  const isPoll = question.type === 'POLL' || question.type === 'TEXT_POLL';

  return (
    <Card
      header={
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--space-5)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <Num style={{ color: 'var(--text-muted)' }}>Q{index + 1}</Num> · {question.prompt}
          </span>
          {result && (
            <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              {isPoll ? (
                <>
                  <Num>{formatNumber(total)}</Num>
                  {NBSP}
                  {t('common:units.answer', { count: total })}
                </>
              ) : (
                <>
                  <Num>{formatNumber(correct)}</Num> / <Num>{formatNumber(total)}</Num>
                  {NBSP}
                  {t('units.correctAnswer', { count: correct })}
                </>
              )}
            </span>
          )}
        </div>
      }
      footer={
        result?.fastestCorrect ? (
          <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
            {t('sessionDetail.fastestLine')} {result.fastestCorrect.nickname} —{' '}
            <Num>{seconds(result.fastestCorrect.elapsedMs)}</Num>
            {NBSP}
            {t('common:units.seconds')}
          </span>
        ) : undefined
      }
    >
      {!result && (
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
          {t('sessionDetail.noResult')}
        </p>
      )}

      {choices && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {choices.entries.map((e, ci) => {
            const isCorrect = question.choices.find((c) => c.id === e.choiceId)?.isCorrect === true;
            return (
              <AnswerOption
                key={e.choiceId}
                size="sm"
                letter={CHOICE_LETTERS[ci % CHOICE_LETTERS.length] ?? 'A'}
                // Poll: every proposition stays neutral (§ 5.2), only the distribution
                // speaks. Elsewhere, green for the expected one, muted for the rest.
                state={isPoll ? 'default' : isCorrect ? 'correct' : 'muted'}
                distribution={total > 0 ? Math.round((e.count / total) * 100) : 0}
                // Read-only: `disabled` takes these twenty-odd buttons out of the tab order
                // and removes the hover. The kit does not style `disabled` on
                // `AnswerOption`, so the rendering is unchanged.
                disabled
                // Shadow removed: the question card already carries the relief (§ 12, never two
                // stacked shadows) — the propositions read here as rows.
                style={{ boxShadow: 'none' }}
              >
                {e.label}
              </AnswerOption>
            );
          })}
        </div>
      )}

      {numeric && <NumericHistogram distribution={numeric} question={question} total={total} />}

      {text && (
        // Grouped free-text answers, most given first (same list as the stage, on the light ground).
        <ul
          aria-label={t('sessionDetail.groupedAnswers')}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          {text.entries.map((e) => (
            <li key={e.text}>
              <Tag>
                {e.text}
                {e.count > 1 && (
                  <Num style={{ marginLeft: 'var(--space-2)', color: 'var(--text-muted)' }}>
                    x{formatNumber(e.count)}
                  </Num>
                )}
              </Tag>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Mini histogram of the numeric answers: one bar per bucket, proportional height,
 * count in mono under the bar. The expected value is recalled next to the median.
 */
function NumericHistogram({
  distribution,
  question,
  total,
}: {
  distribution: NumericDistPayload;
  question: Question;
  total: number;
}) {
  const { t } = useTranslation('admin');
  const max = distribution.buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const bounds = question.numericAnswer ? toleranceBounds(question.numericAnswer) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: 120 }}>
        {distribution.buckets.map((b) => {
          const inRange = bounds !== null && b.to >= bounds.lo && b.from <= bounds.hi;
          return (
            <div
              key={`${b.from}-${b.to}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                justifyContent: 'flex-end',
                height: '100%',
              }}
              title={`${formatNumber(b.from)} – ${formatNumber(b.to)}`}
            >
              <span
                style={{
                  font: 'var(--text-body-sm)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                {formatNumber(b.count)}
              </span>
              <span
                style={{
                  width: '100%',
                  height: max > 0 ? `${Math.max(2, (b.count / max) * 80)}%` : '2%',
                  borderRadius: 'var(--radius-xs)',
                  background: inRange ? 'var(--state-success)' : 'var(--gray-400)',
                }}
              />
              <span
                style={{
                  font: 'var(--text-body-sm)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNumber(Math.round(b.from))}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
        {t('sessionDetail.expectedValue')} <Num>{formatNumber(distribution.expected)}</Num>
        {distribution.median !== null && (
          <>
            {` · ${t('sessionDetail.median')} `}
            <Num>{formatNumber(distribution.median)}</Num>
          </>
        )}
        {' · '}
        <Num>{formatNumber(distribution.correctCount)}</Num> / <Num>{formatNumber(total)}</Num>{' '}
        {t('sessionDetail.withinTolerance')}
      </p>
    </div>
  );
}
