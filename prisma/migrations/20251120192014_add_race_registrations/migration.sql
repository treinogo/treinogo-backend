-- CreateTable
CREATE TABLE "race_registrations" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "distance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_registrations_raceId_athleteId_key" ON "race_registrations"("raceId", "athleteId");

-- AddForeignKey
ALTER TABLE "race_registrations" ADD CONSTRAINT "race_registrations_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_registrations" ADD CONSTRAINT "race_registrations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
