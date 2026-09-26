-- Credential version of a refresh-token family: Admin.passwordChangedAt when the family was opened,
-- inherited on rotation. A refresh whose version differs from the admin's current one is refused,
-- so a rotation racing a password change cannot keep a family alive (see plugins/auth.ts).
ALTER TABLE "RefreshToken" ADD COLUMN "credentialVersion" DATETIME;

-- No backfill on purpose. Existing rows stay NULL: for an admin who never changed their password
-- (passwordChangedAt NULL) that is the matching version and nobody is logged out; for one who did,
-- the rows are refused once and the admin signs in again. Stamping them with the current version
-- would also launder a successor that already escaped a past revocation sweep (the race this fixes).
