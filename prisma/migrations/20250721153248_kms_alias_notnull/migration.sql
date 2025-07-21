/*
  Warnings:

  - Made the column `alias` on table `UserKey` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserKey" ALTER COLUMN "alias" SET NOT NULL;
