// Participant live store (§13.8): fed ONLY by state:snapshot + events.

import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

import type {
  LobbyCountEvent,
  ParticipantFinalView,
  ParticipantQuestionView,
  PhaseEvent,
  QuestionClosedParticipantEvent,
  QuestionOpenEvent,
  SessionFinalParticipantEvent,
  SessionPhase,
  SessionSnapshotForParticipant,
} from '@quiz/shared';

import { clockOffsetFrom } from '../shared-live/clock.ts';

type Snapshot = SessionSnapshotForParticipant;

export interface ParticipantLiveState {
  connected: boolean;
  quizTitle: string | null;
  /** `'ENDED'` once the session is over (snapshot, phase event or `session:ended`). */
  phase: SessionPhase | null;
  questionIndex: number;
  totalQuestions: number;
  you: Snapshot['you'] | null;
  participantCount: number;
  question: Snapshot['question'];
  roundResult: Snapshot['roundResult'];
  final: ParticipantFinalView | null;
  clockOffset: number;
  kicked: boolean;
}

export interface ParticipantLiveActions {
  attach(socket: Socket): void;
  /** A resume refused with KICKED: the socket is gone, no `participant:kicked` event will come. */
  markKicked(): void;
  reset(): void;
}

/** Everything `reset()` restores; the clock offset survives until the next server sample. */
const INITIAL: Omit<ParticipantLiveState, 'clockOffset'> = {
  connected: false,
  quizTitle: null,
  phase: null,
  questionIndex: -1,
  totalQuestions: 0,
  you: null,
  participantCount: 0,
  question: null,
  roundResult: null,
  final: null,
  kicked: false,
};

export const useParticipantLive = create<ParticipantLiveState & ParticipantLiveActions>((set) => ({
  ...INITIAL,
  clockOffset: 0,

  markKicked() {
    set({ kicked: true, connected: false });
  },

  attach(socket) {
    socket.on('state:snapshot', (s: Snapshot) => {
      set({
        connected: true,
        quizTitle: s.quizTitle,
        phase: s.phase,
        questionIndex: s.questionIndex,
        totalQuestions: s.totalQuestions,
        you: s.you,
        participantCount: s.participantCount,
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
    socket.on('question:open', (e: QuestionOpenEvent & { view: ParticipantQuestionView }) => {
      set({
        phase: 'QUESTION_OPEN',
        // Taken here, not from the session:phase that follows: the card renders and submits with
        // this index, a tap before the second packet must not be refused WRONG_QUESTION.
        questionIndex: e.questionIndex,
        question: {
          view: e.view,
          openedAt: e.openedAt,
          closesAt: e.closesAt,
          alreadyAnswered: false,
          yourAnswer: null,
        },
        roundResult: null,
        clockOffset: clockOffsetFrom(e.serverTime),
      });
    });
    socket.on('question:closed', (e: QuestionClosedParticipantEvent) => {
      if (e.audience === 'participant') {
        set((prev) => ({
          phase: 'QUESTION_CLOSED',
          question: null,
          roundResult: e.result,
          you: prev.you ? { ...prev.you, score: e.result.totalScore, rank: e.result.rank } : prev.you,
        }));
      }
    });
    socket.on('session:final', (e: SessionFinalParticipantEvent) => {
      if (e.audience === 'participant') {
        set({ phase: 'FINAL_RANKING', final: e.final, roundResult: null });
      }
    });
    socket.on('session:ended', () => set({ phase: 'ENDED', connected: false }));
    socket.on('lobby:count', (e: LobbyCountEvent) => set({ participantCount: e.count }));
    socket.on('participant:kicked', () => set({ kicked: true, connected: false }));
    socket.on('participant:replaced', () => set({ connected: false }));
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('connect', () => set({ connected: true }));
  },

  reset() {
    set(INITIAL);
  },
}));
