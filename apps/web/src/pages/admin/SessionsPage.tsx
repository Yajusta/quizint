// « Sessions » (plan § 5.3): two tabs, one row per session; each one can be deleted
// (data included) after confirmation.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { z } from 'zod';

import { apiJson, apiPath, ApiErrorThrown } from '../../lib/api-client.ts';
import { formatDate, formatNumber, NBSP } from '../../lib/format.ts';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, Tabs } from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert, Num, PageHeader, riseStyle, ROW } from './AdminLayout.tsx';
import { playedMinutes, SessionListSchema, type SessionListItem } from './session-list.ts';

type Session = SessionListItem;

export function SessionsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('live');
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const remove = async (session: Session) => {
    try {
      await apiJson.delete(apiPath`/sessions/${session.id}`, z.unknown());
      setSessions((list) => list.filter((s) => s.id !== session.id));
      setError(null);
    } catch (e) {
      if (!redirectIfUnauthorized(e, navigate))
        setError(e instanceof ApiErrorThrown ? e.message : t('errors.delete'));
    }
  };

  useEffect(() => {
    apiJson
      .get('/sessions', SessionListSchema)
      .then((s) => setSessions(s.sessions))
      .catch((e) => {
        if (!redirectIfUnauthorized(e, navigate)) setError(t('errors.load'));
      })
      .finally(() => setLoading(false));
  }, [navigate, t]);

  const live = sessions.filter((s) => s.phase !== 'ENDED');
  const ended = sessions.filter((s) => s.phase === 'ENDED');
  const shown = tab === 'live' ? live : ended;

  return (
    <AdminLayout>
      <PageHeader title={t('sessions.title')} />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {/* The tabs and their content form a single block: the template's `gap: var(--space-9)`
          would separate them as much as two independent sections. */}
      <section
        aria-label={tab === 'live' ? t('sessions.liveLabel') : t('sessions.endedLabel')}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
      >
        <Tabs
          tabs={[
            { value: 'live', label: t('sessions.liveTab'), count: live.length },
            { value: 'ended', label: t('sessions.endedTab'), count: ended.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {loading && <ListSkeleton rows={4} />}

        {!loading && shown.length === 0 && (
          <EmptyState
            icon={tab === 'live' ? 'play' : 'history'}
            title={tab === 'live' ? t('sessions.emptyLiveTitle') : t('sessions.emptyEndedTitle')}
            description={
              tab === 'live' ? t('sessions.emptyLiveDescription') : t('sessions.emptyEndedDescription')
            }
          />
        )}

        {!loading && shown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {shown.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                index={i}
                live={tab === 'live'}
                onDelete={() => setDeleteTarget(s)}
              />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={deleteTarget !== null}
        title={t('sessions.deleteTitle')}
        description={
          deleteTarget?.phase === 'ENDED'
            ? t('sessions.deleteEndedDescription')
            : t('sessions.deleteLiveDescription')
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
              {t('sessions.delete')}
            </Button>
          </>
        }
      />
    </AdminLayout>
  );
}

function SessionRow({
  session,
  index,
  live,
  onDelete,
}: {
  session: Session;
  index: number;
  live: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const durationMin = playedMinutes(session);

  return (
    // The layout goes on a child: `Card` already wraps its children in its own padding
    // container, so a `display: flex` set on the card would not reach them.
    <Card padding="sm" style={riseStyle(index)}>
      <div style={ROW}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span style={{ font: 'var(--text-h3)' }}>{session.quizTitle}</span>
          <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
            <Num>{formatDate(session.createdAt)}</Num> · <Num>{session.code}</Num> ·{' '}
            <Num>{formatNumber(session.participantCount)}</Num>
            {NBSP}
            {t('common:units.participant', { count: session.participantCount })}
            {durationMin !== null && (
              <>
                {' · '}
                <Num>{formatNumber(durationMin)}</Num>
                {NBSP}
                {t('units.minutes')}
              </>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
          {/* No « Terminée » badge in the Terminées tab: the tab already says it. */}
          {live && (
            <Badge tone="live" dot>
              {t(`phase.${session.phase}`, { defaultValue: session.phase })}
            </Badge>
          )}
          {live ? (
            <Button size="sm" icon="play" onClick={() => navigate(`/present/${session.id}`)}>
              {t('sessions.resume')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              iconRight="chevron-right"
              onClick={() => navigate(`/admin/sessions/${session.id}`)}
            >
              {t('sessions.detail')}
            </Button>
          )}
          <IconButton
            variant="ghost"
            size="sm"
            icon="trash-2"
            label={t('sessions.deleteLabel')}
            onClick={onDelete}
          />
        </div>
      </div>
    </Card>
  );
}
