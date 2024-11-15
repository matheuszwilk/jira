/*
  Warnings:

  - Made the column `assigneeId` on table `tasks` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "assigneeId" SET NOT NULL;
