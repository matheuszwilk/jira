import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { getMember } from "@/features/members/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import prisma from "@/../lib/db";
import { createProjectSchema, updateProjectSchema } from "../schemas";
import { uploadFile } from "@/features/files/utils";

type HonoBindings = {
  user: {
    id: string;
  };
}

const app = new Hono<{ Bindings: HonoBindings }>()
  .post(
    "/",
    sessionMiddleware,
    zValidator("form", createProjectSchema),
    async (c) => {
      const user = c.get("user");
      const { name, image, workspaceId } = c.req.valid("form");

      const member = await getMember({
        workspaceId,
        userId: user.id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const imageUrl = await uploadFile(image)

      const project = await prisma.projects.create({
        data: {
          name,
          imageUrl: imageUrl as string,
          workspaceId
        }
      });

      return c.json({ data: project });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
      }

      const member = await getMember({
        workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const projects = await prisma.projects.findMany({
        where: {
          workspaceId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return c.json({ data: projects });
    }
  )
  .get(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();

      const project = await prisma.projects.findUnique({
        where: {
          id: projectId
        }
      });

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: project.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({ data: project });
    }
  )
  .patch(
    "/:projectId",
    sessionMiddleware,
    zValidator("form", updateProjectSchema),
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();
      const { name, image } = c.req.valid("form");

      const existingProject = await prisma.projects.findUnique({
        where: {
          id: projectId
        }
      });

      if (!existingProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingProject.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const imageUrl = await uploadFile(image)

      const project = await prisma.projects.update({
        where: {
          id: projectId
        },
        data: {
          name,
          imageUrl: imageUrl as string
        }
      });

      return c.json({ data: project });
    }
  )
  .delete(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();

      const existingProject = await prisma.projects.findUnique({
        where: {
          id: projectId
        }
      });

      if (!existingProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingProject.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Delete associated tasks
      await prisma.tasks.deleteMany({
        where: {
          projectId
        }
      });

      // Delete the project
      await prisma.projects.delete({
        where: {
          id: projectId
        }
      });

      return c.json({ data: { id: existingProject.id } });
    }
  )
  .get(
    "/:projectId/analytics",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();

      const project = await prisma.projects.findUnique({
        where: {
          id: projectId
        }
      });

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: project.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const thisMonthTasks = await prisma.tasks.count({
        where: {
          projectId,
          createdAt: {
            gte: thisMonthStart,
            lte: thisMonthEnd
          }
        }
      });

      const lastMonthTasks = await prisma.tasks.count({
        where: {
          projectId,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const taskCount = thisMonthTasks;
      const taskDifference = taskCount - lastMonthTasks;

      const thisMonthAssignedTasks = await prisma.tasks.count({
        where: {
          projectId,
          assigneeId: member.id,
          createdAt: {
            gte: thisMonthStart,
            lte: thisMonthEnd
          }
        }
      });

      const lastMonthAssignedTasks = await prisma.tasks.count({
        where: {
          projectId,
          assigneeId: member.id,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const assignedTaskCount = thisMonthAssignedTasks;
      const assignedTaskDifference = assignedTaskCount - lastMonthAssignedTasks;

      const thisMonthIncompleteTasks = await prisma.tasks.count({
        where: {
          projectId,
          NOT: {
            status: 'DONE'
          },
          createdAt: {
            gte: thisMonthStart,
            lte: thisMonthEnd
          }
        }
      });

      const lastMonthIncompleteTasks = await prisma.tasks.count({
        where: {
          projectId,
          NOT: {
            status: 'DONE'
          },
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const incompleteTaskCount = thisMonthIncompleteTasks;
      const incompleteTaskDifference = incompleteTaskCount - lastMonthIncompleteTasks;

      const thisMonthCompletedTasks = await prisma.tasks.count({
        where: {
          projectId,
          status: 'DONE',
          createdAt: {
            gte: thisMonthStart,
            lte: thisMonthEnd
          }
        }
      });

      const lastMonthCompletedTasks = await prisma.tasks.count({
        where: {
          projectId,
          status: 'DONE',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const completedTaskCount = thisMonthCompletedTasks;
      const completedTaskDifference = completedTaskCount - lastMonthCompletedTasks;

      const thisMonthOverdueTasks = await prisma.tasks.count({
        where: {
          projectId,
          NOT: {
            status: 'DONE'
          },
          dueDate: {
            lt: now.toISOString()
          },
          createdAt: {
            gte: thisMonthStart,
            lte: thisMonthEnd
          }
        }
      });

      const lastMonthOverdueTasks = await prisma.tasks.count({
        where: {
          projectId,
          NOT: {
            status: 'DONE'
          },
          dueDate: {
            lt: now.toISOString()
          },
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        }
      });

      const overdueTaskCount = thisMonthOverdueTasks;
      const overdueTaskDifference = overdueTaskCount - lastMonthOverdueTasks;

      return c.json({
        data: {
          taskCount,
          taskDifference,
          assignedTaskCount,
          assignedTaskDifference,
          completedTaskCount,
          completedTaskDifference,
          incompleteTaskCount,
          incompleteTaskDifference,
          overdueTaskCount,
          overdueTaskDifference,
        },
      });
    }
  )

export default app;
