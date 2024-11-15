-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "assigneeId" DROP NOT NULL,
ALTER COLUMN "assigneeId" SET DATA TYPE TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workspaces" ALTER COLUMN "imageUrl" DROP NOT NULL;
