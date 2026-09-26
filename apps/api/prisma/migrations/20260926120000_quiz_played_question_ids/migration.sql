-- The played lock no longer depends on answers surviving: deleting a session (RGPD) cascades its
-- answers away, which used to unlock the questions they were given to.
ALTER TABLE "Quiz" ADD COLUMN "playedQuestionIds" JSONB;

-- Backfill: every question that holds an answer today is played for good. Sessions deleted before
-- this migration left nothing behind to recover.
UPDATE "Quiz"
SET "playedQuestionIds" = (
  SELECT json_group_array(DISTINCT q."id")
  FROM "Question" q
  WHERE q."quizId" = "Quiz"."id"
    AND EXISTS (SELECT 1 FROM "Answer" a WHERE a."questionId" = q."id")
)
WHERE EXISTS (
  SELECT 1
  FROM "Question" q
  JOIN "Answer" a ON a."questionId" = q."id"
  WHERE q."quizId" = "Quiz"."id"
);
