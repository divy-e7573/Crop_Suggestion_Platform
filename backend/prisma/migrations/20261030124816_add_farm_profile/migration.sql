-- CreateEnum
CREATE TYPE "LandAreaUnit" AS ENUM ('ACRE', 'HECTARE');

-- CreateTable
CREATE TABLE "FarmProfile" (
    "id" TEXT NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "district" VARCHAR(80) NOT NULL,
    "soilType" "SoilType" NOT NULL,
    "season" "Season" NOT NULL,
    "landArea" DECIMAL(10,2) NOT NULL,
    "landAreaUnit" "LandAreaUnit" NOT NULL,
    "villageOrPin" VARCHAR(80),
    "irrigationType" "IrrigationType",
    "currentCrop" VARCHAR(120),
    "dataSourceId" VARCHAR(80) NOT NULL,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "matchingObservations" INTEGER NOT NULL DEFAULT 0,
    "matchingMarkets" INTEGER NOT NULL DEFAULT 0,
    "matchingIsComplete" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmProfile_state_idx" ON "FarmProfile"("state");

-- CreateIndex
CREATE INDEX "FarmProfile_district_state_idx" ON "FarmProfile"("district", "state");

-- CreateIndex
CREATE INDEX "FarmProfile_createdAt_idx" ON "FarmProfile"("createdAt");
