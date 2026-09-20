// Presenter live store (§13.7): fed by state:snapshot + presenter events.

import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

import type {
  AnswersProgressEvent,
  FinalRankingView,
  LiveSessionSettings,
  ParticipantInfo,
  ParticipantsListEvent,
  PhaseEvent,
  QuestionClosedPresenterEvent,
  QuestionOpenEvent,
  QuestionResultView,
  SessionFinalPresenterEvent,
  SessionPhase,
  SessionSnapshotForPresenter,
  SnapshotQuestion,
} from '@quiz/shared';

import { clockOffsetFrom } from '../shared-live/clock.ts';

export interface PresenterLiveState {
  connected: boolean;
  code: string | null;
  joinUrl: string | null;
  quizTitle: string | null;
  /** `'ENDED'` once the session is over (snapshot, phase event or `session:ended`). */
  phase: SessionPhase | null;
  questionIndex: number;
  totalQuestions: number;
  settings: LiveSessionSettings | null;
  participants: ParticipantInfo[];
  // The connected count is read from the live participants list, not from answers:progress.
  question: {
    view: SnapshotQuestion;
    openedAt: number;
    closesAt: number | null;
    answered: number;
    /** Participants who answered, first answer first. */
    answeredIds: string[];
  } | null;
  roundResult: QuestionResultView | null;
  final: FinalRankingView | null;
  clockOffset: number;
}

export interface PresenterLiveActions {
  attach(socket: Socket): void;
  reset(): void;
}

/** Everything `reset()` restores; the clock offset survives until the next server sample. */
const INITIAL: Omit<PresenterLiveState, 'clockOffset'> = {
  connected: false,
  code: null,
  joinUrl: null,
  quizTitle: null,
  phase: null,
  questionIndex: -1,
  totalQuestions: 0,
  settings: null,
  participants: [],
  question: null,
  roundResult: null,
  final: null,
};

export const usePresenterLive = create<PresenterLiveState & PresenterLiveActions>((set) => ({
  ...INITIAL,
  clockOffset: 0,

  attach(socket) {
    socket.on('state:snapshot', (s: SessionSnapshotForPresenter) => {
      set({
        connected: true,
        code: s.code,
        joinUrl: s.joinUrl,
        quizTitle: s.quizTitle,
        phase: s.phase,
        questionIndex: s.questionIndex,
        totalQuestions: s.totalQuestions,
        settings: s.settings,
        participants: s.participants ?? [],
        question: s.question ?? null,
        roundResult: s.roundResult ?? null,
        final: s.final ?? null,
        clockOffset: clockOffsetFrom(s.serverTime),
      });
    });
    socket.on('session:phase', (e: PhaseEvent) => {
      set((prev) => ({
        phase: e.phase,
        questionIndex: e.questionIndex,
        clockOffset: clockOffsetFrom(e.serverTime),
        question: e.phase === 'QUESTION_OPEN' ? prev.question : null,
      }));
    });
    socket.on('question:open', (e: QuestionOpenEvent & { view: SnapshotQuestion }) => {
      set({
        phase: 'QUESTION_OPEN',
        // Taken here, not from the session:phase that follows: the view and its index move together.
        questionIndex: e.questionIndex,
        question: { view: e.view, openedAt: e.openedAt, closesAt: e.closesAt, answered: 0, answeredIds: [] },
        roundResult: null,
        clockOffset: clockOffsetFrom(e.serverTime),
      });
    });
    socket.on('question:closed', (e: QuestionClosedPresenterEvent) => {
      if (e.audience === 'presenter') {
        set({ phase: 'QUESTION_CLOSED', question: null, roundResult: e.result });
      }
    });
    socket.on('session:final', (e: SessionFinalPresenterEvent) => {
      if (e.audience === 'presenter') set({ phase: 'FINAL_RANKING', final: e.final, roundResult: null });
    });
    socket.on('session:ended', () => set({ phase: 'ENDED', connected: false }));
    socket.on('participants:list', (e: ParticipantsListEvent) => set({ participants: e.participants }));
    socket.on('answers:progress', (e: AnswersProgressEvent) => {
      set((prev) =>
        prev.question && e.questionIndex === prev.questionIndex
          ? { question: { ...prev.question, answered: e.answered, answeredIds: e.answeredIds } }
          : prev,
      );
    });
    socket.on('settings:changed', (settings: LiveSessionSettings) => set({ settings }));
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('connect', () => set({ connected: true }));
  },

  reset() {
    set(INITIAL);
  },
}));
