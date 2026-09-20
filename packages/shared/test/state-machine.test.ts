import { describe, expect, it } from 'vitest';

import { canTransition, isJoinable, nextPhase, transitionRefusalReason } from '../src/state-machine.js';

const ctx = (over: Partial<Parameters<typeof canTransition>[2]> = {}) => ({
  participantCount: 3,
  currentQuestionIndex: 0,
  lastIndex: 5,
  ...over,
});

describe('isJoinable', () => {
  it('takes participants until the final ranking', () => {
    expect((['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED'] as const).map(isJoinable)).toEqual([
      true,
      true,
      true,
    ]);
    expect((['FINAL_RANKING', 'ENDED'] as const).map(isJoinable)).toEqual([false, false]);
  });
});

describe('canTransition', () => {
  it('starts a session from LOBBY with participants', () => {
    expect(canTransition('LOBBY', 'session:start', ctx())).toBe(true);
  });
  it('refuses to start with zero participants', () => {
    expect(canTransition('LOBBY', 'session:start', ctx({ participantCount: 0 }))).toBe(false);
  });
  it('allows a forced start with zero participants', () => {
    expect(canTransition('LOBBY', 'session:start', ctx({ participantCount: 0, force: true }))).toBe(true);
  });
  it('closes an open question', () => {
    expect(canTransition('QUESTION_OPEN', 'question:close', ctx())).toBe(true);
  });
  it('refuses next while a question is open', () => {
    expect(canTransition('QUESTION_OPEN', 'question:next', ctx())).toBe(false);
  });
  it('moves to the next question when closed and not last', () => {
    expect(canTransition('QUESTION_CLOSED', 'question:next', ctx())).toBe(true);
  });
  it('goes back from an open question after the first one', () => {
    expect(canTransition('QUESTION_OPEN', 'question:back', ctx({ currentQuestionIndex: 1 }))).toBe(true);
  });
  it('refuses to go back from the first question', () => {
    expect(canTransition('QUESTION_OPEN', 'question:back', ctx({ currentQuestionIndex: 0 }))).toBe(false);
  });
  it('refuses back from a closed question', () => {
    expect(canTransition('QUESTION_CLOSED', 'question:back', ctx({ currentQuestionIndex: 2 }))).toBe(false);
  });
  it('reopens a closed question, including the first one', () => {
    expect(canTransition('QUESTION_CLOSED', 'question:reopen', ctx({ currentQuestionIndex: 0 }))).toBe(true);
  });
  it('refuses reopen while a question is open', () => {
    expect(canTransition('QUESTION_OPEN', 'question:reopen', ctx())).toBe(false);
  });
  it('ends from any phase', () => {
    for (const phase of ['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED', 'FINAL_RANKING'] as const) {
      expect(canTransition(phase, 'session:end', ctx())).toBe(true);
    }
  });
  it('refuses everything once ENDED', () => {
    expect(canTransition('ENDED', 'session:end', ctx())).toBe(false);
  });
});

describe('nextPhase', () => {
  it('LOBBY → QUESTION_OPEN on start', () => {
    expect(nextPhase('LOBBY', 'session:start', ctx())).toBe('QUESTION_OPEN');
  });
  it('QUESTION_OPEN → QUESTION_CLOSED on close', () => {
    expect(nextPhase('QUESTION_OPEN', 'question:close', ctx())).toBe('QUESTION_CLOSED');
  });
  it('QUESTION_CLOSED → QUESTION_OPEN when a question remains', () => {
    expect(
      nextPhase('QUESTION_CLOSED', 'question:next', ctx({ currentQuestionIndex: 2, lastIndex: 5 })),
    ).toBe('QUESTION_OPEN');
  });
  it('QUESTION_CLOSED → FINAL_RANKING after the last question', () => {
    expect(
      nextPhase('QUESTION_CLOSED', 'question:next', ctx({ currentQuestionIndex: 5, lastIndex: 5 })),
    ).toBe('FINAL_RANKING');
  });
  it('QUESTION_OPEN → QUESTION_CLOSED on back', () => {
    expect(nextPhase('QUESTION_OPEN', 'question:back', ctx({ currentQuestionIndex: 3 }))).toBe(
      'QUESTION_CLOSED',
    );
  });
  it('QUESTION_CLOSED → QUESTION_OPEN on reopen', () => {
    expect(nextPhase('QUESTION_CLOSED', 'question:reopen', ctx())).toBe('QUESTION_OPEN');
  });
  it('LOBBY → ENDED on cancel', () => {
    expect(nextPhase('LOBBY', 'session:end', ctx())).toBe('ENDED');
  });
  it('returns null for an invalid transition', () => {
    expect(nextPhase('LOBBY', 'question:close', ctx())).toBe(null);
  });
});

describe('transitionRefusalReason', () => {
  it('reports NO_PARTICIPANTS for a start without participants', () => {
    expect(transitionRefusalReason('LOBBY', 'session:start', ctx({ participantCount: 0 }))).toBe(
      'NO_PARTICIPANTS',
    );
  });
  it('reports nothing when a forced start is allowed', () => {
    expect(transitionRefusalReason('LOBBY', 'session:start', ctx({ participantCount: 0, force: true }))).toBe(
      null,
    );
  });
  it('reports INVALID_PHASE for a close from LOBBY', () => {
    expect(transitionRefusalReason('LOBBY', 'question:close')).toBe('INVALID_PHASE');
  });
  it('reports INVALID_PHASE for a back from the first question', () => {
    expect(transitionRefusalReason('QUESTION_OPEN', 'question:back', ctx({ currentQuestionIndex: 0 }))).toBe(
      'INVALID_PHASE',
    );
  });
  it('returns null for a valid command', () => {
    expect(transitionRefusalReason('QUESTION_OPEN', 'question:close')).toBe(null);
  });
});
