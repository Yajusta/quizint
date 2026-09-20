-- The logical deletion becomes a reversible archive; rows already "deleted" show up as archived.
ALTER TABLE "Quiz" RENAME COLUMN "deletedAt" TO "archivedAt";
