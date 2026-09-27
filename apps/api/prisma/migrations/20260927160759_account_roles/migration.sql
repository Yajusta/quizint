-- Account role: 'ADMIN' (everything, account management included) or 'USER' (own quizzes, sessions
-- and password only), validated by AccountRole in @quiz/shared (SQLite has no enum). New accounts
-- default to USER, least privilege.
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- Every account that exists before roles could manage every account: they all become admins, so
-- nobody loses a right they had and the instance keeps at least one active ADMIN.
UPDATE "Admin" SET "role" = 'ADMIN';
