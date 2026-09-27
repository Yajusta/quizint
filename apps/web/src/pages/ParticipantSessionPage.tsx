// /j/:code — the whole participant journey in one route, driven by the live store (§8.4).
// Rendering (plan § 5.1): light ground until registration, stage ground from the lobby to the
// final ranking, light again on the terminal states. Screens live in ./participant/*.

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { toLocalTime } from '../features/shared-live/clock.ts';
import { QuestionCard } from '../features/shared-live/QuestionCard.tsx';
import { useParticipantLive } from '../features/participant/live-store.ts';
import { useParticipantSocket } from '../features/participant/useParticipantSocket.ts';
import { useThemeColor } from '../lib/useThemeColor.ts';
import { LobbyScreen } from './participant/LobbyScreen.tsx';
import { NicknameScreen } from './participant/NicknameScreen.tsx';
import { RoundClosedScreen, RoundResultScreen } from './participant/RoundResultScreen.tsx';
import { LightShell, ReconnectBanner, StageShell } from './participant/shells.tsx';
import type { TerminalKind } from './participant/TerminalScreen.tsx';

/**
 * The two end-of-run screens leave the entry chunk (plan § 12, last line): they are shown once, at
 * the very end of the journey, and carry `Podium`-adjacent pieces (`CountUp`, `LeaderboardRow`,
 * `EmptyState`) that the code entry screen has no reason to download. `RoundResultScreen` stays in
 * the chunk: it shows after *every* question, a mid-game load would cost more than it saves.
 */
const importFinal = () => import('./participant/FinalScreen.tsx');
const importTerminal = () => import('./participant/TerminalScreen.tsx');
const FinalScreen = lazy(() => importFinal().then((m) => ({ default: m.FinalScreen })));
const TerminalScreen = lazy(() => importTerminal().then((m) => ({ default: m.TerminalScreen })));

type JoinStatus = 'loading' | 'open' | 'closed' | 'notfound';

export function ParticipantSessionPage() {
  const { code = '' } = useParams();
  const { join, joinErrorCode, submitAnswer, resumePending, reclaim } = useParticipantSocket(code);
  const live = useParticipantLive();

  const [joining, setJoining] = useState(false);
  const [quizInfo, setQuizInfo] = useState<{ quizTitle: string; participantCount: number } | null>(null);

  // Public join info (title, count) before the socket registers; 404/410 drive the terminal states.
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('loading');
  // Bumped by a reclaim: the room may have ended or been deleted while this tab sat on `replaced`,
  // and a refused resume falls back on this lookup to pick its screen.
  const [lookup, setLookup] = useState(0);
  const onReclaim = useCallback(() => {
    setLookup((n) => n + 1);
    reclaim();
  }, [reclaim]);
  useEffect(() => {
    let cancelled = false;
    setJoinStatus('loading');
    setQuizInfo(null);
    fetch(`/api/v1/join/${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) setJoinStatus('notfound');
          return null;
        }
        if (r.status === 410) {
          if (!cancelled) setJoinStatus('closed');
          return null;
        }
        if (r.status === 429) {
          // A whole room behind one NAT can exhaust the per-IP lookup budget: the nickname screen
          // opens without title and count rather than staying on its skeletons.
          if (!cancelled) setJoinStatus('open');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!cancelled && d) {
          setQuizInfo({ quizTitle: d.quizTitle, participantCount: d.participantCount });
          setJoinStatus('open');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code, lookup]);

  // Prefetch on mount: both chunks are tiny and land long before the end of the quiz, so the
  // switch to the ranking or to a terminal screen stays instant.
  useEffect(() => {
    void importFinal();
    void importTerminal();
  }, []);

  const registered = live.you !== null;
  // The public join lookup answers 410 from FINAL_RANKING on: that closes the door to newcomers
  // only. A registered participant (or one whose stored token is still being resumed) must still
  // reach the final ranking; only the ENDED phase or a failed resume ends their journey.
  const closedToNewcomer = joinStatus === 'closed' && !registered && !resumePending;
  const terminal: TerminalKind | null = live.kicked
    ? 'kicked'
    : closedToNewcomer || live.phase === 'ENDED'
      ? 'ended'
      : live.replaced
        ? 'replaced'
        : joinStatus === 'notfound'
          ? 'notfound'
          : null;

  useThemeColor(registered && terminal === null ? 'stage' : 'light');

  // Fallback: the same ground as the expected screen, never a blank page (§ 5.1 « deux fonds »).
  if (terminal)
    return (
      <Suspense fallback={<LightShell>{null}</LightShell>}>
        <TerminalScreen kind={terminal} onReclaim={onReclaim} />
      </Suspense>
    );

  // A stored token is being resumed: no nickname prompt while the snapshot is on its way.
  if (!registered && resumePending) return <LightShell>{null}</LightShell>;

  if (!registered) {
    return (
      <NicknameScreen
        quizTitle={live.quizTitle ?? quizInfo?.quizTitle ?? null}
        participantCount={quizInfo?.participantCount ?? null}
        errorCode={joinErrorCode}
        joining={joining}
        onJoin={async (nickname) => {
          if (joining) return;
          setJoining(true);
          const result = await join(nickname);
          setJoining(false);
          if (!result.ok && result.code === 'SESSION_CLOSED_TO_JOIN') setJoinStatus('closed');
        }}
      />
    );
  }

  const nickname = live.you?.nickname ?? '';
  const title = live.quizTitle ?? quizInfo?.quizTitle ?? 'Quiz';

  const reconnecting = !live.connected && live.phase !== null;

  return (
    <>
      {reconnecting && <ReconnectBanner />}

      {(live.phase === 'LOBBY' || live.phase === null) && (
        <LobbyScreen
          nickname={nickname}
          quizTitle={title}
          totalQuestions={live.totalQuestions}
          participantCount={live.participantCount}
        />
      )}

      {live.phase === 'QUESTION_OPEN' && live.question && (
        <StageShell padded={false} align="start">
          <QuestionCard
            key={live.question.view.id}
            view={live.question.view}
            index={live.questionIndex}
            total={live.totalQuestions}
            closesAt={toLocalTime(live.question.closesAt, live.clockOffset)}
            alreadyAnswered={live.question.alreadyAnswered}
            answeredChoiceId={
              live.question.yourAnswer && 'choiceId' in live.question.yourAnswer
                ? live.question.yourAnswer.choiceId
                : null
            }
            answeredText={
              live.question.yourAnswer && 'text' in live.question.yourAnswer
                ? live.question.yourAnswer.text
                : null
            }
            onSubmit={(answer) => submitAnswer(live.questionIndex, answer)}
          />
        </StageShell>
      )}

      {live.phase === 'QUESTION_CLOSED' && live.roundResult === null && <RoundClosedScreen />}
      {live.phase === 'QUESTION_CLOSED' && live.roundResult && (
        <RoundResultScreen result={live.roundResult} />
      )}

      {live.phase === 'FINAL_RANKING' && live.final && (
        <Suspense
          fallback={
            <RoundClosedScreen title="roundResult.quizOverTitle" footer="roundResult.quizOverFooter" />
          }
        >
          <FinalScreen final={live.final} nickname={nickname} />
        </Suspense>
      )}
      {live.phase === 'FINAL_RANKING' && !live.final && (
        <RoundClosedScreen title="roundResult.quizOverTitle" footer="roundResult.quizOverFooter" />
      )}
    </>
  );
}
