// Session phase state machine (§6.2). Pure, 100% tested.

import type { SessionPhase } from './schemas/domain.js';

export type SessionCommand =
  'session:start' | 'question:close' | 'question:next' | 'question:back' | 'question:reopen' | 'session:end';

export interface TransitionContext {
  /** Number of non-kicked participants currently registered. */
  participantCount: number;
  /** Current question index (0-based, -1 in LOBBY). */
  currentQuestionIndex: number;
  /** Index of the last question (questions.length - 1). */
  lastIndex: number;
  /** Whether the command carries force: true (session:start only). */
  force?: boolean;
}

const VALID: Record<SessionPhase, SessionCommand[]> = {
  LOBBY: ['session:start', 'session:end'],
  // question:back returns from an open question to the previous result (its answers are discarded);
  // question:reopen returns from a result to its own question (same: answers discarded).
  QUESTION_OPEN: ['question:close', 'question:back', 'session:end'],
  QUESTION_CLOSED: ['question:next', 'question:reopen', 'session:end'],
  FINAL_RANKING: ['session:end'],
  ENDED: [],
};

export function canTransition(phase: SessionPhase, command: SessionCommand, ctx: TransitionContext): boolean {
  if (!VALID[phase].includes(command)) return false;
  // VALID already pins the phase; session:start and question:back have an extra guard. The
  // idempotence check (expectedIndex === currentQuestionIndex) belongs to SessionManager.
  if (command === 'session:start') return ctx.participantCount >= 1 || ctx.force === true;
  // The first question has no previous result to go back to.
  if (command === 'question:back') return ctx.currentQuestionIndex >= 1;
  return true;
}

export function nextPhase(
  phase: SessionPhase,
  command: SessionCommand,
  ctx: TransitionContext,
): SessionPhase | null {
  if (!canTransition(phase, command, ctx)) return null;
  switch (command) {
    case 'session:start':
      return 'QUESTION_OPEN';
    case 'question:close':
      return 'QUESTION_CLOSED';
    case 'question:next':
      return ctx.currentQuestionIndex < ctx.lastIndex ? 'QUESTION_OPEN' : 'FINAL_RANKING';
    case 'question:back':
      return 'QUESTION_CLOSED';
    case 'question:reopen':
      return 'QUESTION_OPEN';
    case 'session:end':
      return 'ENDED';
  }
}

/** A session takes new participants until its final ranking: the REST pre-check and the socket join agree. */
export function isJoinable(phase: SessionPhase): boolean {
  return phase !== 'FINAL_RANKING' && phase !== 'ENDED';
}

/** Human-readable reason a transition was refused, for logs and acks. */
export function transitionRefusalReason(
  phase: SessionPhase,
  command: SessionCommand,
  ctx?: TransitionContext,
): string | null {
  if (VALID[phase].includes(command)) {
    if (command === 'session:start' && phase === 'LOBBY' && ctx && ctx.participantCount < 1 && !ctx.force) {
      return 'NO_PARTICIPANTS';
    }
    if (command === 'question:back' && ctx && ctx.currentQuestionIndex < 1) return 'INVALID_PHASE';
    return null;
  }
  return 'INVALID_PHASE';
}
