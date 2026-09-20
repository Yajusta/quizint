// « Mes quiz » (plan § 5.3): « En direct » band, card grid, recent sessions.
// The data layer (REST via api-client, 401 redirect, JSON import) is unchanged;
// only the rendering changes.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { z } from 'zod';

import { SessionCreatedDTO } from '@quiz/shared';

import { apiJson, ApiErrorThrown } from '../../lib/api-client.ts';
import { formatDate, formatNumber, formatShortDate, NBSP } from '../../lib/format.ts';
import { Badge, Button, Card, EmptyState, Icon, IconButton } from '../../design-system/index.ts';
import { GridSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, ROW, SectionTitle } from './AdminLayout.tsx';
import { SessionListSchema, type SessionListItem } from './session-list.ts';

const QuizListSchema = z.object({
  quizzes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      questionCount: z.number(),
      sessionCount: z.number(),
      lastPlayedAt: z.number().nullable(),
      updatedAt: z.number(),
    }),
  ),
});

type Quiz = z.infer<typeof QuizListSchema>['quizzes'][number];

export function DashboardPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [q, s] = await Promise.all([
        apiJson.get('/quizzes', QuizListSchema),
        apiJson.get('/sessions', SessionListSchema),
      ]);
      setQuizzes(q.quizzes);
      setSessions(s.sessions);
      setError(null);
      setLoading(false);
    } catch (e) {
      if (redirectIfUnauthorized(e, navigate)) return;
      setError(t('errors.load'));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The POST always creates a session: a double click would leave an orphan lobby behind.
  const launching = useRef(false);
  const launch = async (quizId: string) => {
    if (launching.current) return;
    launching.current = true;
    try {
      const created = await apiJson.post(`/quizzes/${quizId}/sessions`, {}, SessionCreatedDTO);
      navigate(`/present/${created.sessionId}`);
    } catch (e) {
      setError(e instanceof ApiErrorThrown ? e.message : t('errors.launch'));
    } finally {
      launching.current = false;
    }
  };

  // Reversible (« Quiz archivés » page): no confirmation, the card disappears at once.
  const archive = async (quizId: string) => {
    try {
      await apiJson.post(`/quizzes/${quizId}/archive`, {}, z.unknown());
      setQuizzes((list) => list.filter((q) => q.id !== quizId));
      setError(null);
    } catch (e) {
      if (redirectIfUnauthorized(e, navigate)) return;
      setError(e instanceof ApiErrorThrown ? e.message : t('dashboard.archiveError'));
    }
  };

  const importQuiz = async (file: File) => {
    setImporting(true);
    setError(null);
    setWarnings([]);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await apiJson.post(
        '/quizzes/import',
        parsed,
        z.object({
          quiz: z.object({ id: z.string(), title: z.string(), questionCount: z.number() }),
          warnings: z.array(z.string()),
        }),
      );
      setWarnings(result.warnings);
      await load();
    } catch (e) {
      setError(e instanceof ApiErrorThrown ? e.message : t('dashboard.importError'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const liveSessions = sessions.filter((s) => s.phase !== 'ENDED');
  const recentSessions = sessions.filter((s) => s.phase === 'ENDED').slice(0, 5);

  const lastPlayed = quizzes.reduce<number | null>(
    (max, q) => (q.lastPlayedAt !== null && (max === null || q.lastPlayedAt > max) ? q.lastPlayedAt : max),
    null,
  );
  // Hidden while loading and on an empty library: « 0 quiz » would duplicate the `EmptyState`.
  const subtitle =
    loading || quizzes.length === 0 ? undefined : (
      <>
        <Num>{formatNumber(quizzes.length)}</Num>
        {NBSP}
        {t('units.quiz', { count: quizzes.length })}
        {lastPlayed !== null && (
          <>
            {` · ${t('dashboard.lastSession')} `}
            <Num>{formatShortDate(lastPlayed)}</Num>
          </>
        )}
      </>
    );

  return (
    <AdminLayout>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={subtitle}
        actions={
          <>
            {/* Native file picker: the kit has no « fichier » field, and the JSON import must open
                the system dialog. Hidden, driven by the kit button. */}
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              id="import-quiz"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importQuiz(f);
              }}
            />
            <Button variant="ghost" icon="archive" onClick={() => navigate('/admin/quizzes/archived')}>
              {t('dashboard.archives')}
            </Button>
            <Button
              variant="secondary"
              icon="upload"
              loading={importing}
              onClick={() => fileRef.current?.click()}
            >
              {t('dashboard.import')}
            </Button>
            <Button icon="plus" onClick={() => navigate('/admin/quizzes/new')}>
              {t('dashboard.newQuiz')}
            </Button>
          </>
        }
      />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {warnings.length > 0 && (
        <div
          role="status"
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            padding: 'var(--space-5) var(--space-7)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--state-warning-soft)',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--state-warning)', paddingTop: 2 }}>
            <Icon name="circle-help" size="sm" />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <strong style={{ font: 'var(--text-label)' }}>{t('dashboard.importWarningsTitle')}</strong>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {warnings.map((w) => (
                <li key={w} style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {liveSessions.length > 0 && (
        <section
          aria-label={t('dashboard.liveLabel')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-7)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-brand-soft)',
          }}
        >
          <h2
            style={{
              font: 'var(--text-overline)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wide)',
              color: 'var(--text-brand)',
            }}
          >
            {t('dashboard.live')}
          </h2>
          {liveSessions.map((s, i) => (
            <div key={s.id} style={{ ...ROW, ...riseStyle(i) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <Badge tone="live" dot>
                  {t(`phase.${s.phase}`, { defaultValue: s.phase })}
                </Badge>
                <span style={{ font: 'var(--text-h3)' }}>{s.quizTitle}</span>
                <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                  <Num>{s.code}</Num> · <Num>{formatNumber(s.participantCount)}</Num>
                  {NBSP}
                  {t('common:units.participant', { count: s.participantCount })}
                </span>
              </div>
              <Button size="sm" icon="play" onClick={() => navigate(`/present/${s.id}`)}>
                {t('dashboard.resume')}
              </Button>
            </div>
          ))}
        </section>
      )}

      {loading && <GridSkeleton cards={6} />}

      {!loading && quizzes.length === 0 && (
        // Centred in the remaining space; no action here, « Nouveau quiz » is already the single
        // primary of the header — two identical primaries would compete for the eye.
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
          <EmptyState
            icon="list-plus"
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDescription')}
          />
        </div>
      )}

      {!loading && quizzes.length > 0 && (
        <section
          aria-label={t('dashboard.listLabel')}
          style={{
            display: 'grid',
            // 320 rather than 300: at 1024 px (§ 11.2) the grid must fall back to two columns, and
            // 3 × 300 + 2 × 24 still fit in the 960 px available. Three columns from 1160.
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-7)',
          }}
        >
          {quizzes.map((q, i) => (
            <QuizCard
              key={q.id}
              quiz={q}
              index={i}
              onLaunch={() => void launch(q.id)}
              onArchive={() => void archive(q.id)}
            />
          ))}
        </section>
      )}

      {!loading && recentSessions.length > 0 && (
        <section
          aria-label={t('dashboard.recentLabel')}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <SectionTitle>{t('dashboard.recent')}</SectionTitle>
          {recentSessions.map((s, i) => (
            <Card key={s.id} padding="sm" style={riseStyle(i)}>
              <div style={ROW}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <span style={{ font: 'var(--text-h3)' }}>{s.quizTitle}</span>
                  <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                    <Num>{formatDate(s.createdAt)}</Num> · <Num>{formatNumber(s.participantCount)}</Num>
                    {NBSP}
                    {t('common:units.participant', { count: s.participantCount })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight="chevron-right"
                  onClick={() => navigate(`/admin/sessions/${s.id}`)}
                >
                  {t('dashboard.detail')}
                </Button>
              </div>
            </Card>
          ))}
          <Link to="/admin/sessions" style={{ font: 'var(--text-body-sm)', alignSelf: 'flex-start' }}>
            {t('dashboard.allHistory')}
          </Link>
        </section>
      )}
    </AdminLayout>
  );
}

/**
 * Quiz card (§ 5.3). The admin's signature gesture: on hover the card lifts by one pixel
 * and takes `--shadow-2` (provided by `Card interactive`) — nothing else moves.
 */
function QuizCard({
  quiz,
  index,
  onLaunch,
  onArchive,
}: {
  quiz: Quiz;
  index: number;
  onLaunch: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const editHref = `/admin/quizzes/${quiz.id}`;
  const empty = quiz.questionCount === 0;

  return (
    <Card
      interactive
      onClick={() => navigate(editHref)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        // Pins the footer to the bottom of the card: without it the footers of one row drift
        // as soon as a title wraps onto two lines.
        justifyContent: 'space-between',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
        ...riseStyle(index),
      }}
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" icon="play" onClick={onLaunch} disabled={empty}>
            {t('dashboard.launch')}
          </Button>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <IconButton
              variant="ghost"
              size="sm"
              icon="archive"
              label={t('dashboard.archive')}
              onClick={onArchive}
            />
            <IconButton
              variant="ghost"
              size="sm"
              icon="pencil"
              label={t('dashboard.edit')}
              onClick={() => navigate(editHref)}
            />
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          <h3 style={{ font: 'var(--text-h3)' }}>
            <Link
              to={editHref}
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'inherit', textDecoration: 'none', borderBottom: 'none' }}
            >
              {quiz.title}
            </Link>
          </h3>
          {/* Only the state that needs fixing carries a badge: « Prêt » in green would be the normal
              painted in colour, and § 3 reserves green for revealing a result. */}
          {empty && <Badge tone="warning">{t('dashboard.emptyBadge')}</Badge>}
        </div>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
          <Num>{formatNumber(quiz.questionCount)}</Num>
          {NBSP}
          {t('common:units.question', { count: quiz.questionCount })}
          {quiz.sessionCount > 0 && (
            <>
              {` · ${t('dashboard.playedTimes')} `}
              <Num>{formatNumber(quiz.sessionCount)}</Num>
              {NBSP}
              {t('units.times', { count: quiz.sessionCount })}
            </>
          )}
        </p>
        {quiz.description && (
          <p
            style={{
              font: 'var(--text-body-sm)',
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {quiz.description}
          </p>
        )}
        {quiz.lastPlayedAt !== null && (
          <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
            {t('dashboard.lastSessionOn')}
            {NBSP}
            <Num>{formatShortDate(quiz.lastPlayedAt)}</Num>
          </p>
        )}
      </div>
    </Card>
  );
}
