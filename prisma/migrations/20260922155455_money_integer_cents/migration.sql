-- MONEY BECOMES INTEGER CENTS HERE.
--
-- READ THIS BEFORE REPLAYING AGAINST A DATABASE THAT HOLDS REAL ROWS.
--
-- The INSERT ... SELECT statements below copy the old Float values straight
-- across. That is a TRUNCATING CAST, not a conversion: a balance of 120.5
-- dollars lands as 120 cents, which is $1.20. It is correct here only because
-- this migration was created against an empty development database.
--
-- To run this where money already exists, scale first. Per column:
--   UPDATE "Membership" SET "balance" = ROUND("balance" * 100);
--   UPDATE "Bet"        SET "proposerLiability" = ROUND("proposerLiability" * 100);
--   UPDATE "Position"   SET "amount" = ROUND("amount" * 100),
--                          "balanceAtEntry" = ROUND("balanceAtEntry" * 100),
--                          "payout" = ROUND("payout" * 100);
-- Then verify the circle still sums to what it did before, and only then
-- narrow the column types.

/*
  Warnings:

  - You are about to alter the column `proposerLiability` on the `Bet` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `balance` on the `Membership` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `amount` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `balanceAtEntry` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to alter the column `payout` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circleId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "opponentId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sideALabel" TEXT NOT NULL,
    "sideBLabel" TEXT NOT NULL,
    "proposerSide" TEXT NOT NULL DEFAULT 'B',
    "proposerLiability" INTEGER NOT NULL DEFAULT 2500,
    "subjectElo" REAL NOT NULL,
    "difficultyElo" REAL NOT NULL,
    "openingProbA" REAL NOT NULL,
    "deadline" DATETIME NOT NULL,
    "resolutionDeadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bet_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bet_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bet_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChallengeTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bet" ("category", "circleId", "createdAt", "creatorId", "deadline", "difficultyElo", "id", "openingProbA", "opponentId", "proposerLiability", "proposerSide", "resolutionDeadline", "sideALabel", "sideBLabel", "status", "subjectElo", "subjectId", "templateId", "title") SELECT "category", "circleId", "createdAt", "creatorId", "deadline", "difficultyElo", "id", "openingProbA", "opponentId", "proposerLiability", "proposerSide", "resolutionDeadline", "sideALabel", "sideBLabel", "status", "subjectElo", "subjectId", "templateId", "title" FROM "Bet";
DROP TABLE "Bet";
ALTER TABLE "new_Bet" RENAME TO "Bet";
CREATE INDEX "Bet_circleId_status_idx" ON "Bet"("circleId", "status");
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 12000,
    "forecastElo" REAL NOT NULL DEFAULT 1200,
    "forecastBets" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("balance", "circleId", "forecastBets", "forecastElo", "id", "joinedAt", "userId") SELECT "balance", "circleId", "forecastBets", "forecastElo", "id", "joinedAt", "userId" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_userId_circleId_key" ON "Membership"("userId", "circleId");
CREATE TABLE "new_Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "betId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "probAtEntry" REAL NOT NULL,
    "multiplierAtEntry" REAL NOT NULL,
    "balanceAtEntry" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Position_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Position" ("amount", "balanceAtEntry", "betId", "createdAt", "id", "multiplierAtEntry", "payout", "probAtEntry", "side", "userId") SELECT "amount", "balanceAtEntry", "betId", "createdAt", "id", "multiplierAtEntry", "payout", "probAtEntry", "side", "userId" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
CREATE INDEX "Position_betId_idx" ON "Position"("betId");
CREATE UNIQUE INDEX "Position_betId_userId_key" ON "Position"("betId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
