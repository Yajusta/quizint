// /present/:sessionId — the projected stage (§ 8.2, plan § 5.2). Socket hook and store are untouched;
// this file only orchestrates: phase → screen, keyboard shortcuts (ignored while a Dialog is open),
// the participants panel docked on the right and the confirmations. Screens live in ./Stage*.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import type { ParticipantInfo, SnapshotQuestion } from '@quiz/shared';

import { PresenterSkeleton } from '../../components/Skeletons.tsx';
import { Button, Dialog, StageInsetContext } from '../../design-system/index.ts';
import { usePresenterLive } from '../../features/presenter/live-store.ts';
import { usePresenterSocket } from '../../features/presenter/usePresenterSocket.ts';
import { toLocalTime } from '../../features/shared-live/clock.ts';
import { useThemeColor } from '../../lib/useThemeColor.ts';
import { ReconnectBanner } from '../participant/shells.tsx';
import { PARTICIPANTS_PANEL_WIDTH, ParticipantsPanel } from './ParticipantsPanel.tsx';
import { StageClosed } from './StageClosed.tsx';
import { StageEnded } from './StageEnded.tsx';
import { StageFinal } from './StageFinal.tsx';
import { StageLobby } from './StageLobby.tsx';
import { StageQuestion } from './StageQuestion.tsx';
import { StageControlsContext, StageWaiting, type StageControls } from './stage-shared.tsx';

/** Input types that take no typed text: the stage shortcuts stay live while one has focus. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);

// Only text entry swallows the shortcuts. A focused switch (« Réponses nominatives » right after a
// click) must not: Space would toggle it back off instead of moving to the next question.
function isEditable(target: EventTarget | null): boolean {
  return (
    (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

/** Tracks the Fullscreen API, whatever toggled it (F, the footer button, the browser's Escape). */
function useFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return fullscreen;
}

/** Confirmations of the stage commands that cannot be undone from the stage itself. */
type Confirm = 'startEmpty' | 'back' | 'reopen';

/** Dictionary keys of each confirmation, in the `presenter` namespace. */
const CONFIRMS: Record<Confirm, { key: string; danger: boolean }> = {
  startEmpty: { key: 'startEmpty', danger: false },
  back: { key: 'back', danger: true },
  reopen: { key: 'reopen', danger: true },
};

export function PresenterSessionPage() {
  const { t } = useTranslation(['presenter', 'common']);
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { command } = usePresenterSocket(sessionId);
  const live = usePresenterLive();
  useThemeColor('stage');
  const fullscreen = useFullscreen();

  const [panelOpen, setPanelOpen] = useState(false);
  const [endDialog, setEndDialog] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [kickTarget, setKickTarget] = useState<ParticipantInfo | null>(null);
  const [showNames, setShowNames] = useState(false);
  const dialogOpen = endDialog || confirm !== null || kickTarget !== null;

  // The store drops the question at close; the result screen keeps the wording it showed, for the
  // question just closed and for an earlier one reached with « Résultat précédent ».
  const views = useRef(new Map<number, SnapshotQuestion>());
  if (live.question) views.current.set(live.questionIndex, live.question.view);

  // « Réponses nominatives » is the session setting itself: toggling it persists through
  // `settings:update`, so the choice carries over to the next result screen and survives a reload.
  // The local state is optimistic; `settings:changed` (or a snapshot) realigns it.
  const sessionNames = live.settings?.showParticipantAnswers ?? false;
  useEffect(() => {
    setShowNames(sessionNames);
  }, [sessionNames]);
  const changeShowNames = useCallback(
    (value: boolean) => {
      setShowNames(value);
      void command('settings:update', { showParticipantAnswers: value });
    },
    [command],
  );

  // Stable between two `participants:list`: `answers:progress` re-renders this page four times a
  // second, and the lobby chips and the panel rows must not follow.
  const alive = useMemo(() => live.participants.filter((p) => !p.isKicked), [live.participants]);
  const isLast = live.questionIndex >= live.totalQuestions - 1;
  const answered = live.question?.answered ?? 0;

  const start = useCallback(
    (force: boolean) => {
      void command('session:start', force ? { force: true } : {});
    },
    [command],
  );

  // Espace / → : the single next action of the phase (§ 5.2). INDEX_MISMATCH from a double press is
  // ignored (§ 6.4). At the final ranking the shortcut opens the confirmation rather than ending;
  // an empty lobby asks before starting a run nobody will answer.
  const mainAction = useCallback(() => {
    switch (live.phase) {
      case 'LOBBY':
        if (alive.length > 0) start(false);
        else setConfirm('startEmpty');
        break;
      case 'QUESTION_OPEN':
        void command('question:close', { expectedIndex: live.questionIndex });
        break;
      case 'QUESTION_CLOSED':
        void command('question:next', { expectedIndex: live.questionIndex });
        break;
      case 'FINAL_RANKING':
        setEndDialog(true);
        break;
      default:
        break;
    }
  }, [live.phase, live.questionIndex, alive.length, start, command]);

  // ← : one step back. From a question to the previous result (asks first when answers would be
  // lost), from a result to its question (always asks: its answers are discarded).
  const canGoBack =
    live.phase === 'QUESTION_CLOSED' || (live.phase === 'QUESTION_OPEN' && live.questionIndex >= 1);
  const backAction = useCallback(() => {
    if (live.phase === 'QUESTION_CLOSED') setConfirm('reopen');
    else if (live.phase === 'QUESTION_OPEN' && live.questionIndex >= 1) {
      if (answered > 0) setConfirm('back');
      else void command('question:back', { expectedIndex: live.questionIndex });
    }
  }, [live.phase, live.questionIndex, answered, command]);

  const confirmed = (kind: Confirm) => {
    setConfirm(null);
    if (kind === 'startEmpty') start(true);
    else if (kind === 'back') void command('question:back', { expectedIndex: live.questionIndex });
    else void command('question:reopen', { expectedIndex: live.questionIndex });
  };

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || e.repeat || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
      switch (e.key) {
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          togglePanel();
          break;
        case 'Escape':
          setPanelOpen(false);
          break;
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          mainAction();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          backAction();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, mainAction, backAction, togglePanel]);

  const controls = useMemo<StageControls>(
    () => ({ panelOpen, togglePanel, fullscreen, toggleFullscreen }),
    [panelOpen, togglePanel, fullscreen],
  );

  const openEnd = () => setEndDialog(true);
  const goResults = () => navigate(`/admin/sessions/${sessionId}`);

  if (live.phase === 'ENDED') return <StageEnded onHistory={goResults} />;
  if (live.phase === null) return <PresenterSkeleton quizTitle={live.quizTitle ?? undefined} />;

  const confirmSpec = confirm ? CONFIRMS[confirm] : null;

  return (
    <StageControlsContext.Provider value={controls}>
      <StageInsetContext.Provider value={panelOpen ? PARTICIPANTS_PANEL_WIDTH : 0}>
        {!live.connected && <ReconnectBanner />}

        <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--stage-bg)' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {live.phase === 'LOBBY' && (
              <StageLobby
                quizTitle={live.quizTitle ?? 'Quiz'}
                code={live.code ?? ''}
                joinUrl={live.joinUrl}
                totalQuestions={live.totalQuestions}
                participants={alive}
                onStart={() => start(false)}
                onStartEmpty={() => setConfirm('startEmpty')}
                onEnd={openEnd}
              />
            )}

            {live.phase === 'QUESTION_OPEN' && live.question && (
              <StageQuestion
                key={`${live.question.view.id}-${live.question.openedAt}`}
                view={live.question.view}
                index={live.questionIndex}
                total={live.totalQuestions}
                closesAt={toLocalTime(live.question.closesAt, live.clockOffset)}
                answered={live.question.answered}
                connected={alive.filter((p) => p.connected).length}
                participants={alive.length}
                onClose={mainAction}
                onBack={canGoBack ? backAction : undefined}
                onEnd={openEnd}
              />
            )}

            {live.phase === 'QUESTION_CLOSED' && live.roundResult && (
              <StageClosed
                key={live.roundResult.questionIndex}
                view={views.current.get(live.roundResult.questionIndex) ?? null}
                result={live.roundResult}
                index={live.questionIndex}
                total={live.totalQuestions}
                isLast={isLast}
                showTop5={live.settings?.showIntermediateRanking ?? true}
                showNames={showNames}
                onShowNamesChange={changeShowNames}
                onNext={mainAction}
                onReopen={backAction}
                onEnd={openEnd}
              />
            )}
            {live.phase === 'QUESTION_CLOSED' && !live.roundResult && (
              <StageWaiting title={t('waiting.results')} />
            )}

            {live.phase === 'FINAL_RANKING' && live.final && (
              <StageFinal final={live.final} onResults={goResults} onEnd={openEnd} />
            )}
            {live.phase === 'FINAL_RANKING' && !live.final && <StageWaiting title={t('waiting.ranking')} />}
          </div>

          <ParticipantsPanel
            open={panelOpen}
            participants={alive}
            answeredIds={live.phase === 'QUESTION_OPEN' ? live.question?.answeredIds : undefined}
            code={live.code ?? ''}
            joinUrl={live.joinUrl}
            onClose={() => setPanelOpen(false)}
            onKick={setKickTarget}
          />
        </div>

        <Dialog
          open={confirmSpec !== null}
          title={confirmSpec ? t(`confirm.${confirmSpec.key}Title`) : ''}
          description={confirmSpec ? t(`confirm.${confirmSpec.key}Description`) : undefined}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant={confirmSpec?.danger ? 'danger' : 'primary'}
                onClick={() => confirm && confirmed(confirm)}
              >
                {confirmSpec ? t(`confirm.${confirmSpec.key}Action`) : ''}
              </Button>
            </>
          }
        />

        <Dialog
          open={endDialog}
          title={t('confirm.endTitle')}
          description={
            live.phase === 'FINAL_RANKING'
              ? t('confirm.endDescriptionFinal')
              : t('confirm.endDescriptionRunning')
          }
          onClose={() => setEndDialog(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEndDialog(false)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setEndDialog(false);
                  void command('session:end', {});
                }}
              >
                {t('confirm.endAction')}
              </Button>
            </>
          }
        />

        <Dialog
          open={kickTarget !== null}
          title={kickTarget ? t('confirm.kickTitle', { name: kickTarget.nickname }) : ''}
          description={t('confirm.kickDescription')}
          onClose={() => setKickTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setKickTarget(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = kickTarget;
                  setKickTarget(null);
                  if (target) void command('participant:kick', { participantId: target.id });
                }}
              >
                {t('confirm.kickAction')}
              </Button>
            </>
          }
        />
      </StageInsetContext.Provider>
    </StageControlsContext.Provider>
  );
}
