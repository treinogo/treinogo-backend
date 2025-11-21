-- DropIndex
DROP INDEX IF EXISTS "race_registrations_raceId_athleteId_key";

-- CreateIndex
CREATE UNIQUE INDEX "race_registrations_raceId_athleteId_distance_key" ON "race_registrations"("raceId", "athleteId", "distance");

