-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('LIVE', 'RECENT', 'DEMO', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('RUPEES_PER_QUINTAL', 'RUPEES_PER_KILOGRAM', 'RUPEES_PER_TONNE');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('KHARIF', 'RABI', 'ZAID', 'WHOLE_YEAR');

-- CreateEnum
CREATE TYPE "SoilType" AS ENUM ('ALLUVIAL', 'BLACK', 'RED', 'LATERITE', 'SANDY', 'OTHER');

-- CreateEnum
CREATE TYPE "IrrigationType" AS ENUM ('RAINFED', 'DRIP', 'SPRINKLER', 'FLOOD', 'CANAL', 'WELL', 'OTHER');

-- CreateEnum
CREATE TYPE "CropCategory" AS ENUM ('CEREAL', 'PULSE', 'OILSEED', 'VEGETABLE', 'FRUIT', 'CASH', 'SPICE', 'OTHER');

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "district" VARCHAR(80) NOT NULL,
    "locality" VARCHAR(120),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "source" VARCHAR(80) NOT NULL,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "CropCategory" NOT NULL DEFAULT 'OTHER',
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "source" VARCHAR(80) NOT NULL DEFAULT 'demo-seed',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandiPriceObservation" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "observedAt" DATE NOT NULL,
    "minPrice" DECIMAL(12,2) NOT NULL,
    "maxPrice" DECIMAL(12,2) NOT NULL,
    "modalPrice" DECIMAL(12,2) NOT NULL,
    "unit" "PriceUnit" NOT NULL DEFAULT 'RUPEES_PER_QUINTAL',
    "source" VARCHAR(80) NOT NULL,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "fetchedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MandiPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropSuitabilityRule" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "ruleVersion" VARCHAR(40) NOT NULL,
    "soilTypes" "SoilType"[] DEFAULT ARRAY[]::"SoilType"[],
    "seasons" "Season"[] DEFAULT ARRAY[]::"Season"[],
    "irrigationTypes" "IrrigationType"[] DEFAULT ARRAY[]::"IrrigationType"[],
    "applicableStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minLandAreaAcre" DECIMAL(10,2),
    "maxLandAreaAcre" DECIMAL(10,2),
    "explanation" VARCHAR(600) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "source" VARCHAR(80) NOT NULL DEFAULT 'demo-seed',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CropSuitabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Market_state_idx" ON "Market"("state");

-- CreateIndex
CREATE INDEX "Market_district_state_idx" ON "Market"("district", "state");

-- CreateIndex
CREATE INDEX "Market_dataStatus_idx" ON "Market"("dataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_state_district_key" ON "Market"("name", "state", "district");

-- CreateIndex
CREATE INDEX "Crop_category_idx" ON "Crop"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_slug_key" ON "Crop"("slug");

-- CreateIndex
CREATE INDEX "MandiPriceObservation_marketId_observedAt_idx" ON "MandiPriceObservation"("marketId", "observedAt");

-- CreateIndex
CREATE INDEX "MandiPriceObservation_cropId_observedAt_idx" ON "MandiPriceObservation"("cropId", "observedAt");

-- CreateIndex
CREATE INDEX "MandiPriceObservation_dataStatus_idx" ON "MandiPriceObservation"("dataStatus");

-- CreateIndex
CREATE INDEX "MandiPriceObservation_observedAt_idx" ON "MandiPriceObservation"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MandiPriceObservation_cropId_marketId_observedAt_key" ON "MandiPriceObservation"("cropId", "marketId", "observedAt");

-- CreateIndex
CREATE INDEX "CropSuitabilityRule_cropId_isActive_idx" ON "CropSuitabilityRule"("cropId", "isActive");

-- CreateIndex
CREATE INDEX "CropSuitabilityRule_ruleVersion_idx" ON "CropSuitabilityRule"("ruleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CropSuitabilityRule_cropId_ruleVersion_key" ON "CropSuitabilityRule"("cropId", "ruleVersion");

-- AddForeignKey
ALTER TABLE "MandiPriceObservation" ADD CONSTRAINT "MandiPriceObservation_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandiPriceObservation" ADD CONSTRAINT "MandiPriceObservation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropSuitabilityRule" ADD CONSTRAINT "CropSuitabilityRule_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
