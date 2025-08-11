/*
  Warnings:

  - You are about to drop the column `permissionLevel` on the `ShareGroup` table. All the data in the column will be lost.
  - Made the column `iv` on table `EncryptedDEK` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EncryptedDEK" ALTER COLUMN "iv" SET NOT NULL;

-- AlterTable
ALTER TABLE "ShareGroup" DROP COLUMN "permissionLevel";

-- DropEnum
DROP TYPE "PermissionLevel";
