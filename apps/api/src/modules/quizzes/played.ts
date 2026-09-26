// "Played" questions (§3.2 locking): answered in a session, whether that session still exists or
// was deleted since. Shared by the quiz routes (lock checks) and the session DELETE route (which
// records the ids before the answers cascade away).

import type { PrismaClient } from '@prisma/client';

/**
 * `Quiz.playedQuestionIds`: questions answered in a session since deleted. Written by the session
 * DELETE route before the answers cascade away, so the lock outlives them.
 */
export function storedPlayedQuestionIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

/** Every played question of a quiz: the stored ids plus the questions that still have answers. */
export async function loadPlayedQuestionIds(
  prisma: PrismaClient,
  quiz: { id: string; playedQuestionIds: unknown },
): Promise<Set<string>> {
  const answered = await prisma.question.findMany({
    where: { quizId: quiz.id, answers: { some: {} } },
    select: { id: true },
  });
  return new Set([...storedPlayedQuestionIds(quiz.playedQuestionIds), ...answered.map((q) => q.id)]);
}
