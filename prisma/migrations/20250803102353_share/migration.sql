/*
  Warnings:

  - You are about to drop the column `folderPath` on the `SharedFile` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedById` on the `SharedFile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId,kekIdUsed]` on the table `EncryptedDEK` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shareGroupId,fileId]` on the table `SharedFile` will be added. If there are existing duplicate values, this will fail.
  - Made the column `kekIdUsed` on table `EncryptedDEK` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `shareGroupId` to the `SharedFile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sharedById` to the `SharedFile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SharedFile" DROP CONSTRAINT "SharedFile_uploadedById_fkey";

-- DropIndex
DROP INDEX "EncryptedDEK_fileId_key";

-- AlterTable
ALTER TABLE "EncryptedDEK" ALTER COLUMN "kekIdUsed" SET NOT NULL;

-- AlterTable
ALTER TABLE "EncryptedDEK" ALTER COLUMN "iv" SET NOT NULL;

-- AlterTable
ALTER TABLE "SharedFile" DROP COLUMN "folderPath",
DROP COLUMN "uploadedById",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "shareGroupId" TEXT NOT NULL,
ADD COLUMN     "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sharedById" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedDEK_fileId_kekIdUsed_key" ON "EncryptedDEK"("fileId", "kekIdUsed");

-- CreateIndex
CREATE INDEX "SharedFile_shareGroupId_idx" ON "SharedFile"("shareGroupId");

-- CreateIndex
CREATE INDEX "SharedFile_fileId_idx" ON "SharedFile"("fileId");

-- CreateIndex
CREATE INDEX "SharedFile_sharedById_idx" ON "SharedFile"("sharedById");

-- CreateIndex
CREATE UNIQUE INDEX "SharedFile_shareGroupId_fileId_key" ON "SharedFile"("shareGroupId", "fileId");

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_shareGroupId_fkey" FOREIGN KEY ("shareGroupId") REFERENCES "ShareGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
