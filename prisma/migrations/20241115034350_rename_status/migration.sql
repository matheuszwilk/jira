/*
  Warnings:

  - You are about to drop the column `stauts` on the `tasks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "stauts",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'BACKLOG';
