/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `TwoFactor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");
