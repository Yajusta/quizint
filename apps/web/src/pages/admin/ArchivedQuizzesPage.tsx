// « Quiz archivés »: the quizzes removed from the library. Restoring puts them back in « Mes quiz »;
// permanent deletion (confirmed) takes the quiz and all its sessions with it.

import { useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { z } from 'zod';

import { apiJson, apiPath, ApiErrorThrown } from '../../lib/api-client.ts';
import { formatDate, formatNumber, NBSP } from '../../lib/format.ts';
import { Button, Card, Dialog, EmptyState } from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, ROW } from './AdminLayout.tsx';

const ArchivedListSchema = z.object({
  quizzes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      questionCount: z.number(),
      sessionCount: z.number(),
      archivedAt: z.number().nullable(),
    }),
  ),
});

type ArchivedQuiz = z.infer<typeof ArchivedListSchema>['quizzes'][number];

const NoContent = z.unknown();

export function ArchivedQuizzesPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<ArchivedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedQuiz | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiJson.get('/quizzes?archived=true', ArchivedListSchema);
      setQuizzes(res.quizzes);
      setError(null);
    } catch (e) {
      if (!redirectIfUnauthorized(e, navigate)) setError(t('errors.load'));
    } finally {
      setLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (quiz: ArchivedQuiz, run: () => Promise<unknown>, failure: string) => {
    setPending(quiz.id);
    try {
      await run();
      setQuizzes((list) => list.filter((q) => q.id !== quiz.id));
      setError(null);
    } catch (e) {
      if (!redirectIfUnauthorized(e, navigate)) setError(e instanceof ApiErrorThrown ? e.message : failure);
    } finally {
      setPending(null);
    }
  };

  const restore = (quiz: ArchivedQuiz) =>
    act(
      quiz,
      () => apiJson.post(apiPath`/quizzes/${quiz.id}/restore`, {}, NoContent),
      t('archived.restoreError'),
    );

  const remove = (quiz: ArchivedQuiz) =>
    act(quiz, () => apiJson.delete(apiPath`/quizzes/${quiz.id}`, NoContent), t('errors.delete'));

  return (
    <AdminLayout>
      <PageHeader
        title={t('archived.title')}
        actions={
          <Button variant="secondary" icon="arrow-left" onClick={() => navigate('/admin')}>
            {t('archived.back')}
          </Button>
        }
      />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading && <ListSkeleton rows={4} />}

      {!loading && quizzes.length === 0 && (
        <EmptyState
          icon="archive"
          title={t('archived.emptyTitle')}
          description={t('archived.emptyDescription')}
        />
      )}

      {!loading && quizzes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {quizzes.map((q, i) => (
            <Card key={q.id} padding="sm" style={riseStyle(i)}>
              <div style={ROW}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <span style={{ font: 'var(--text-h3)' }}>{q.title}</span>
                  <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
                    <Num>{formatNumber(q.questionCount)}</Num>
                    {NBSP}
                    {t('common:units.question', { count: q.questionCount })} ·{' '}
                    <Num>{formatNumber(q.sessionCount)}</Num>
                    {NBSP}
                    {t('units.session', { count: q.sessionCount })}
                    {q.archivedAt !== null && (
                      <>
                        {` · ${t('archived.archivedOn')} `}
                        <Num>{formatDate(q.archivedAt)}</Num>
                      </>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="rotate-ccw"
                    loading={pending === q.id}
                    onClick={() => void restore(q)}
                  >
                    {t('archived.restore')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash-2"
                    disabled={pending === q.id}
                    onClick={() => setDeleteTarget(q)}
                  >
                    {t('archived.delete')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        title={t('archived.deleteTitle')}
        description={
          deleteTarget &&
          (deleteTarget.sessionCount > 0 ? (
            <Trans
              i18nKey="archived.deleteWithSessions"
              ns="admin"
              count={deleteTarget.sessionCount}
              values={{ title: deleteTarget.title, count: deleteTarget.sessionCount }}
              components={{ num: <Num /> }}
            />
          ) : (
            <Trans
              i18nKey="archived.deleteWithoutSessions"
              ns="admin"
              values={{ title: deleteTarget.title }}
              components={{ num: <Num /> }}
            />
          ))
        }
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) void remove(target);
              }}
            >
              {t('archived.deleteConfirm')}
            </Button>
          </>
        }
      />
    </AdminLayout>
  );
}
