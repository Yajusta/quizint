-- The played lock follows the answers again: deleting a session (RGPD) cascades its answers away and
-- unlocks the questions no remaining session answered. The ids recorded by deleted sessions go with
-- the column, so a quiz whose sessions are all gone is editable again.
ALTER TABLE "Quiz" DROP COLUMN "playedQuestionIds";
