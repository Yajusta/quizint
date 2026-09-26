-- Credential version of an admin: every password change stamps it, and access JWTs issued before
-- the stamp are refused (see plugins/auth.ts).
ALTER TABLE "Admin" ADD COLUMN "passwordChangedAt" DATETIME;
