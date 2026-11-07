-- Add the analysis access token to the farmer profile table.
--
-- Phase 9 privacy review: `GET /api/farm-profile/latest` used to return the
-- most recently saved farmer profile to anybody who asked for it, which meant
-- one farmer's location details could be read by another visitor on a shared
-- deployment. Each profile now carries an unguessable access token, and only
-- the holder of that token may read the profile back.
--
-- Only the SHA-256 hash of the token is stored, so a copy of this database
-- cannot be used to read anyone's profile. The column is nullable so the
-- rows that already exist keep working without a backfill.

-- AlterTable
ALTER TABLE "FarmProfile" ADD COLUMN "analysisTokenHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "FarmProfile_analysisTokenHash_key" ON "FarmProfile"("analysisTokenHash");
