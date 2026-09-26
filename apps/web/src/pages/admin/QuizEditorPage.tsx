// Quiz editor (plan § 5.3 « Éditeur », lot 4): header band, 280 / fluid / 340 grid — question list
// with `@dnd-kit`, question form, « Réglages · Aperçu » tabs. This file orchestrates data and
// state; the panes live in ./editor/*. Data layer unchanged: REST via api-client, explicit save
// (Ctrl+S) keeping ids, 24 h local draft, `QUIZ_LOCKED` handled per question, duplicate / export /
// launch, media upload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { z } from 'zod';

import { QuestionDTO, QuizSettings } from '@quiz/shared';

import { apiJson, apiPath, ApiErrorThrown } from '../../lib/api-client.ts';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import { Button, Card, Dialog, EmptyState, Icon, Tabs } from '../../design-system/index.ts';
import { ListSkeleton } from '../../components/Skeletons.tsx';
import { redirectIfUnauthorized } from '../../lib/admin-identity.ts';
import { AdminLayout, ErrorAlert } from './AdminLayout.tsx';
import { EditorHeader, type EditorState } from './editor/EditorHeader.tsx';
import { QuestionList } from './editor/QuestionList.tsx';
import { InfoCard, QuestionForm } from './editor/QuestionForm.tsx';
import { QuestionSettings } from './editor/QuestionSettings.tsx';
import { QuestionPreview } from './editor/QuestionPreview.tsx';
import {
  isLockReason,
  clearDraft,
  draftKey,
  fromServerQuestion,
  newQuestion,
  readDraft,
  serialize,
  toServerQuestion,
  validateQuestion,
  writeDraft,
  type EditorQuestion,
} from './editor/model.ts';

const QuizDetailSchema = z.object({
  quiz: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    settings: QuizSettings,
    isLocked: z.boolean(),
    questions: z.array(QuestionDTO),
  }),
});

const QuestionsResponse = z.object({ quiz: z.object({ questions: z.array(QuestionDTO) }) });

/** What the server currently holds — the dirty flag is « current ≠ baseline ». */
interface Baseline {
  title: string;
  description: string;
  questions: string; // JSON of toServerQuestion[]
}

interface EditorError {
  /** Already-translated text: it mixes API messages with dictionary strings. */
  message: string;
  /** Question to select and flag, when the API pointed at one (`QUIZ_LOCKED`, `VALIDATION`). */
  questionKey?: string;
}

const WIDE_QUERY = '(min-width: 1200px)';

const HEADER_OFFSET = 56 + 72; // admin bar + editor header, for the sticky right column

export function QuizEditorPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  // From 1200 px the right column sits beside the form; below, it goes under it (§ 5.3).
  const wide = useMediaQuery(WIDE_QUERY);

  const [quizId, setQuizId] = useState<string | null>(id ?? null);
  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionCollapsed, setDescriptionCollapsed] = useState(false);
  const [settings, setSettings] = useState<QuizSettings>(() => QuizSettings.parse({}));
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [baseline, setBaseline] = useState<Baseline>({ title: '', description: '', questions: '[]' });
  const [draftRestored, setDraftRestored] = useState(false);
  const [error, setError] = useState<EditorError | null>(null);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'settings' | 'preview'>('settings');

  // --- Load ----------------------------------------------------------------------------------

  const applyServer = useCallback(
    (quiz: z.infer<typeof QuizDetailSchema>['quiz'], keepKeys: EditorQuestion[] = []) => {
      const qs = quiz.questions.map((q, i) => fromServerQuestion(q, keepKeys[i]?.key));
      setTitle(quiz.title);
      setDescription(quiz.description ?? '');
      setDescriptionCollapsed(Boolean(quiz.description?.trim()));
      setSettings(quiz.settings);
      setIsLocked(quiz.isLocked);
      setQuestions(qs);
      setBaseline({
        title: quiz.title.trim(),
        description: (quiz.description ?? '').trim(),
        questions: JSON.stringify(qs.map(toServerQuestion)),
      });
      return qs;
    },
    [],
  );

  /** Id of the quiz created by this page: the route change it triggers must not reload it. */
  const createdRef = useRef<string | null>(null);

  useEffect(() => {
    if (id && createdRef.current === id) return;
    let alive = true;
    const key = draftKey(id ?? null);
    // Fresh route (first mount, or duplicate → copy): start over.
    setQuizId(id ?? null);
    setError(null);
    setAttempted(false);
    setTouched(new Set());
    setDraftRestored(false);
    setRightTab('settings');
    if (isNew) {
      setDescriptionCollapsed(false);
      setSettings(QuizSettings.parse({}));
      setIsLocked(false);
      setBaseline({ title: '', description: '', questions: '[]' });
      const draft = readDraft(key);
      const qs = draft && (draft.title || draft.questions.length > 0) ? draft.questions : [];
      setTitle(draft?.title ?? '');
      setDescription(draft?.description ?? '');
      setQuestions(qs);
      setSelectedKey(qs[0]?.key ?? null);
      setDraftRestored(qs.length > 0 || Boolean(draft?.title));
      setLoading(false);
      return;
    }
    setLoading(true);
    apiJson
      .get(apiPath`/quizzes/${id}`, QuizDetailSchema)
      .then(({ quiz }) => {
        if (!alive) return;
        const qs = applyServer(quiz);
        let shown = qs;
        // 24 h local draft (§ 5.3): restored only if it still differs from what the server holds.
        const draft = readDraft(key);
        if (
          draft &&
          serialize(draft) !==
            serialize({ title: quiz.title, description: quiz.description ?? '', questions: qs })
        ) {
          setTitle(draft.title);
          setDescription(draft.description);
          setQuestions(draft.questions);
          shown = draft.questions;
          setDraftRestored(true);
        } else {
          clearDraft(key);
        }
        setSelectedKey(shown[0]?.key ?? null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive || redirectIfUnauthorized(e, navigate)) return;
        setError({ message: t('editor.notFound') });
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, applyServer, navigate, t]);

  // --- Derived ---------------------------------------------------------------------------------

  const questionsJson = useMemo(() => JSON.stringify(questions.map(toServerQuestion)), [questions]);
  const dirty =
    title.trim() !== baseline.title ||
    description.trim() !== baseline.description ||
    questionsJson !== baseline.questions;

  const issuesByKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof validateQuestion>>();
    for (const q of questions) {
      const issues = validateQuestion(q);
      if (issues.length > 0) map.set(q.key, issues);
    }
    return map;
  }, [questions]);

  /** Errors are shown once a question was edited, or after a save attempt (a blank new question stays quiet). */
  const shownInvalid = useMemo(() => {
    const set = new Set<string>();
    for (const key of issuesByKey.keys()) if (attempted || touched.has(key)) set.add(key);
    return set;
  }, [issuesByKey, attempted, touched]);

  const selected = questions.find((q) => q.key === selectedKey) ?? questions[0];
  const selectedIndex = selected ? questions.indexOf(selected) : -1;
  const isLockedQuestion = useCallback((q: EditorQuestion) => isLocked && q.id !== undefined, [isLocked]);

  const state: EditorState = dirty ? 'dirty' : quizId ? 'saved' : 'new';

  // --- Draft persistence -------------------------------------------------------------------------

  const currentDraftKey = draftKey(quizId);
  useEffect(() => {
    if (loading) return;
    if (!dirty) {
      clearDraft(currentDraftKey);
      return;
    }
    writeDraft(currentDraftKey, { title, description, questions });
  }, [loading, dirty, currentDraftKey, title, description, questions]);

  // --- Mutations ---------------------------------------------------------------------------------

  const updateQuestion = (next: EditorQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.key === next.key ? next : q)));
    if (!touched.has(next.key)) setTouched((t) => new Set(t).add(next.key));
  };

  const addQuestion = () => {
    const q = newQuestion({
      pointsCorrect: settings.defaultPointsCorrect,
      pointsWrong: settings.defaultPointsWrong,
      timeLimitSec: settings.defaultTimeLimitSec,
    });
    setQuestions((prev) => [...prev, q]);
    setSelectedKey(q.key);
    setRightTab('settings');
  };

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= questions.length || from === to) return;
    setQuestions((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  };

  const confirmDelete = () => {
    if (!deleteKey) return;
    const index = questions.findIndex((q) => q.key === deleteKey);
    const next = questions.filter((q) => q.key !== deleteKey);
    setQuestions(next);
    if (selectedKey === deleteKey) setSelectedKey(next[Math.min(index, next.length - 1)]?.key ?? null);
    setDeleteKey(null);
  };

  const failWith = (e: unknown, fallback: string) => {
    if (redirectIfUnauthorized(e, navigate)) return;
    if (e instanceof ApiErrorThrown) {
      const details = (e.details ?? {}) as { questionId?: string; reason?: string; question?: number };
      const byId = details.questionId ? questions.find((q) => q.id === details.questionId) : undefined;
      const byIndex = typeof details.question === 'number' ? questions[details.question] : undefined;
      const target = byId ?? byIndex;
      const reason =
        details.reason && isLockReason(details.reason) ? t(`lockReason.${details.reason}`) : undefined;
      setError({
        message: reason ? `${e.message} (${reason}).` : e.message,
        questionKey: target?.key,
      });
      if (target) setSelectedKey(target.key);
      return;
    }
    setError({ message: fallback });
  };

  /** Persists title, description and questions; returns the quiz id, or `null` when nothing was saved. */
  const save = async (): Promise<string | null> => {
    if (saving) return null;
    setAttempted(true);
    setError(null);
    if (!title.trim()) {
      setError({ message: t('editor.titleRequired') });
      return null;
    }
    const invalid = questions.find((q) => issuesByKey.has(q.key));
    if (invalid) {
      setSelectedKey(invalid.key);
      setError({ message: t('editor.fixQuestions'), questionKey: invalid.key });
      return null;
    }
    setSaving(true);
    try {
      let currentId = quizId;
      const created = !currentId;
      if (!currentId) {
        const res = await apiJson.post(
          '/quizzes',
          { title: title.trim(), description: description.trim() || null, settings: {} },
          z.object({ quiz: z.object({ id: z.string() }) }),
        );
        currentId = res.quiz.id;
        clearDraft(draftKey(null));
        createdRef.current = currentId;
        setQuizId(currentId);
        navigate(`/admin/quizzes/${currentId}`, { replace: true });
      } else if (title.trim() !== baseline.title || description.trim() !== baseline.description) {
        await apiJson.patch(
          apiPath`/quizzes/${currentId}`,
          { title: title.trim(), description: description.trim() || null },
          z.unknown(),
        );
      }
      let savedQuestions = questions;
      if (created || questionsJson !== baseline.questions) {
        const res = await apiJson.put(
          apiPath`/quizzes/${currentId}/questions`,
          { questions: questions.map(toServerQuestion) },
          QuestionsResponse,
        );
        // Ids come back from the server; client keys are kept by position so the selection holds.
        savedQuestions = res.quiz.questions.map((q, i) => fromServerQuestion(q, questions[i]?.key));
        const saved = savedQuestions;
        // The panes stay editable during the round trip: what was typed meanwhile is kept (and
        // stays dirty against the baseline below), only the new server ids are copied over.
        setQuestions((current) => {
          if (current === questions) return saved;
          const choiceIds = new Map<string, string | undefined>();
          const questionIds = new Map<string, string | undefined>();
          questions.forEach((sent, i) => {
            questionIds.set(sent.key, saved[i]?.id);
            sent.choices.forEach((c, j) => choiceIds.set(c.key, saved[i]?.choices[j]?.id));
          });
          return current.map((q) => ({
            ...q,
            id: q.id ?? questionIds.get(q.key),
            choices: q.choices.map((c) => ({ ...c, id: c.id ?? choiceIds.get(c.key) })),
          }));
        });
      }
      setBaseline({
        title: title.trim(),
        description: description.trim(),
        questions: JSON.stringify(savedQuestions.map(toServerQuestion)),
      });
      setDraftRestored(false);
      clearDraft(draftKey(currentId));
      if (description.trim()) setDescriptionCollapsed(true);
      return currentId;
    } catch (e) {
      failWith(e, t('editor.saveError'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S / ⌘S (§ 5.3). The listener is bound once and reads the latest `save` through a ref.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const launch = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      // Unsaved edits are saved first: a session on stale questions would be a trap.
      const currentId = dirty || !quizId ? await save() : quizId;
      if (!currentId) return;
      const created = await apiJson.post(
        apiPath`/quizzes/${currentId}/sessions`,
        {},
        z.object({ sessionId: z.string() }),
      );
      navigate(`/present/${created.sessionId}`);
    } catch (e) {
      failWith(e, t('errors.launch'));
    } finally {
      setLaunching(false);
    }
  };

  const duplicate = async () => {
    if (!quizId) return;
    try {
      const copy = await apiJson.post(
        apiPath`/quizzes/${quizId}/duplicate`,
        {},
        z.object({ quiz: z.object({ id: z.string() }) }),
      );
      navigate(`/admin/quizzes/${copy.quiz.id}`);
    } catch (e) {
      failWith(e, t('editor.duplicateError'));
    }
  };

  const exportJson = () => {
    if (quizId) window.open(apiPath`/api/v1/quizzes/${quizId}/export`, '_blank', 'noopener');
  };

  const discardDraft = () => {
    clearDraft(currentDraftKey);
    setDraftRestored(false);
    if (!quizId) {
      setTitle('');
      setDescription('');
      setQuestions([]);
      return;
    }
    setLoading(true);
    apiJson
      .get(apiPath`/quizzes/${quizId}`, QuizDetailSchema)
      .then(({ quiz }) => {
        const qs = applyServer(quiz);
        setSelectedKey(qs[0]?.key ?? null);
      })
      .catch((e: unknown) => failWith(e, t('editor.reloadError')))
      .finally(() => setLoading(false));
  };

  const deleting = deleteKey ? questions.find((q) => q.key === deleteKey) : undefined;
  const selectedIssues =
    selected && shownInvalid.has(selected.key) ? (issuesByKey.get(selected.key) ?? []) : [];

  // --- Render ------------------------------------------------------------------------------------

  return (
    <AdminLayout>
      <EditorHeader
        title={title}
        onTitleChange={setTitle}
        titleError={attempted && title.trim().length === 0}
        state={state}
        locked={isLocked}
        saving={saving}
        launching={launching}
        persisted={quizId !== null}
        canLaunch={questions.length > 0 && !saving}
        onBack={() => navigate('/admin')}
        onExport={exportJson}
        onDuplicate={() => void duplicate()}
        onSave={() => void save()}
        onLaunch={() => void launch()}
      />

      {(error || isLocked || draftRestored) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {isLocked && (
            <Notice
              tone="warning"
              icon="lock"
              action={
                <Button variant="secondary" size="sm" icon="copy" onClick={() => void duplicate()}>
                  {t('editor.lockedAction')}
                </Button>
              }
            >
              {t('editor.lockedNotice')}
            </Notice>
          )}
          {draftRestored && (
            <Notice
              tone="neutral"
              icon="history"
              action={
                <Button variant="ghost" size="sm" onClick={discardDraft}>
                  {t('editor.draftAction')}
                </Button>
              }
            >
              {t('editor.draftNotice')}
            </Notice>
          )}
          {error && <ErrorAlert>{error.message}</ErrorAlert>}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: wide ? '280px minmax(0, 1fr) 340px' : '280px minmax(0, 1fr)',
          gap: 'var(--space-7)',
          alignItems: 'start',
        }}
      >
        {loading ? (
          <ListSkeleton rows={4} height={84} />
        ) : (
          <QuestionList
            questions={questions}
            selectedKey={selected?.key ?? null}
            invalidKeys={shownInvalid}
            isLockedQuestion={isLockedQuestion}
            reorderDisabled={isLocked}
            onSelect={setSelectedKey}
            onAdd={addQuestion}
            onDelete={setDeleteKey}
            onMove={moveQuestion}
          />
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            minWidth: 0,
            // No question selected: nothing to settle or preview, the centre takes the right column too.
            gridColumn: wide && !loading && !selected ? '2 / -1' : undefined,
          }}
        >
          {loading ? (
            <ListSkeleton rows={2} height={200} />
          ) : (
            <>
              <InfoCard
                description={description}
                onChange={setDescription}
                collapsed={descriptionCollapsed}
                onToggle={setDescriptionCollapsed}
              />
              {selected ? (
                <QuestionForm
                  key={selected.key}
                  q={selected}
                  index={selectedIndex}
                  locked={isLockedQuestion(selected)}
                  issues={selectedIssues}
                  onChange={updateQuestion}
                />
              ) : (
                <Card>
                  <EmptyState
                    icon="list-plus"
                    title={t('editor.emptyTitle')}
                    description={t('editor.emptyDescription')}
                    action={
                      <Button icon="plus" onClick={addQuestion}>
                        {t('editor.addQuestion')}
                      </Button>
                    }
                  />
                </Card>
              )}
            </>
          )}
        </div>

        {!loading && selected && (
          <Card
            padding="none"
            style={{
              gridColumn: wide ? undefined : 2,
              position: wide ? 'sticky' : undefined,
              top: wide ? HEADER_OFFSET + 24 : undefined,
            }}
          >
            <Tabs
              aria-label={t('editor.rightPane')}
              tabs={[
                { value: 'settings', label: t('editor.tabSettings'), icon: 'settings' },
                { value: 'preview', label: t('editor.tabPreview'), icon: 'eye' },
              ]}
              value={rightTab}
              onChange={(v) => setRightTab(v === 'preview' ? 'preview' : 'settings')}
              style={{ padding: '0 var(--space-7)' }}
            />
            <div style={{ padding: 'var(--space-7)' }}>
              {rightTab === 'settings' ? (
                <QuestionSettings
                  key={selected.key}
                  q={selected}
                  locked={isLockedQuestion(selected)}
                  issues={selectedIssues}
                  onChange={updateQuestion}
                />
              ) : (
                <QuestionPreview q={selected} index={selectedIndex} total={questions.length} />
              )}
            </div>
          </Card>
        )}
      </div>

      {deleting && (
        <Dialog
          title={t('editor.deleteQuestionTitle')}
          description={
            deleting.prompt.trim()
              ? t('editor.deleteQuestionDescription', {
                  prompt:
                    deleting.prompt.trim().slice(0, 120) + (deleting.prompt.trim().length > 120 ? '…' : ''),
                })
              : t('editor.deleteQuestionBlank')
          }
          onClose={() => setDeleteKey(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteKey(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button variant="danger" icon="trash-2" onClick={confirmDelete}>
                {t('editor.delete')}
              </Button>
            </>
          }
        />
      )}
    </AdminLayout>
  );
}

/** Page-level notice: warning (lock) or neutral (draft restored). Icon, one sentence, one action. */
function Notice({
  tone,
  icon,
  action,
  children,
}: {
  tone: 'warning' | 'neutral';
  icon: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--radius-lg)',
        background: tone === 'warning' ? 'var(--state-warning-soft)' : 'var(--gray-100)',
        color: 'var(--text-primary)',
      }}
    >
      <span
        style={{
          color: tone === 'warning' ? 'var(--state-warning)' : 'var(--text-secondary)',
          display: 'flex',
        }}
      >
        <Icon name={icon} size="md" />
      </span>
      <p style={{ flex: '1 1 320px', font: 'var(--text-body-sm)', color: 'var(--text-primary)' }}>
        {children}
      </p>
      {action}
    </div>
  );
}
