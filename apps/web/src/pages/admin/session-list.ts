// Session list shared by « Mes quiz » and « Sessions ».

import { z } from 'zod';

export const SessionListSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      quizTitle: z.string(),
      phase: z.string(),
      participantCount: z.number(),
      startedAt: z.number().nullable(),
      endedAt: z.number().nullable(),
      createdAt: z.number(),
    }),
  ),
});

export type SessionListItem = z.infer<typeof SessionListSchema>['sessions'][number];

/** Played duration in whole minutes (at least 1), or null while the session is not over. */
export function playedMinutes(s: { startedAt: number | null; endedAt: number | null }): number | null {
  return s.startedAt !== null && s.endedAt !== null
    ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))
    : null;
}
