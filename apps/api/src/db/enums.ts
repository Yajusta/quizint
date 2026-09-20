// Enum columns are plain TEXT on SQLite (the connector has no enum support), so Prisma
// hands them back as `string`. These narrow them at the DB boundary using the Zod
// schemas of @quiz/shared, which stay the single source of truth for the domain.

import { MediaKind, QuestionType, SessionPhase } from '@quiz/shared';

export const asQuestionType = (value: string): QuestionType => QuestionType.parse(value);
export const asMediaKind = (value: string): MediaKind => MediaKind.parse(value);
export const asPhase = (value: string): SessionPhase => SessionPhase.parse(value);
