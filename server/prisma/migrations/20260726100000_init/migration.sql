-- Initial relational model. Constraints live in SQL because Prisma schema
-- validation cannot currently express PostgreSQL CHECK constraints.
CREATE TYPE "Platform" AS ENUM ('ZOMATO', 'SWIGGY', 'UBER', 'RAPIDO', 'OLA', 'OTHER');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "earnings" DECIMAL(12,2) NOT NULL,
    "distanceKm" DECIMAL(10,3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(120) NOT NULL DEFAULT '',
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_earnings_nonnegative" CHECK ("earnings" >= 0),
    CONSTRAINT "orders_distance_nonnegative" CHECK ("distanceKm" >= 0),
    CONSTRAINT "orders_duration_nonnegative" CHECK ("durationMinutes" >= 0)
);

CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mileageKmPerLitre" DECIMAL(6,2) NOT NULL DEFAULT 40,
    "petrolPricePerLitre" DECIMAL(8,2) NOT NULL DEFAULT 105,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settings_mileage_positive" CHECK ("mileageKmPerLitre" > 0),
    CONSTRAINT "settings_petrol_price_nonnegative" CHECK ("petrolPricePerLitre" >= 0),
    CONSTRAINT "settings_currency_inr" CHECK ("currency" = 'INR')
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "orders_userId_clientId_key" ON "orders"("userId", "clientId");
CREATE INDEX "orders_userId_occurredAt_idx" ON "orders"("userId", "occurredAt");
CREATE INDEX "orders_userId_updatedAt_idx" ON "orders"("userId", "updatedAt");
CREATE UNIQUE INDEX "settings_userId_key" ON "settings"("userId");

ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
