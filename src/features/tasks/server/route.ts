import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { getMember } from "@/features/members/utils";

import { sessionMiddleware } from "@/lib/session-middleware";

import { createTaskSchema } from "../schemas";
import db from "@/../lib/db";
import { $Enums } from "@prisma/client";

const app = new Hono()
  .delete(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { taskId } = c.req.param();

      const task = await db.tasks.findUnique({
        where: {
          id: taskId,
        },
      });

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const member = await getMember({
        workspaceId: task.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await db.tasks.delete({
        where: {
          id: taskId,
        },
      });

      return c.json({ data: { id: taskId } });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.nativeEnum($Enums.Status).nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    ),
    async (c) => {
      const user = c.get("user");

      const {
        workspaceId,
        projectId,
        status,
        search,
        assigneeId,
        dueDate,
      } = c.req.valid("query");

      const member = await getMember({
        workspaceId: workspaceId as string,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const tasks = await db.tasks.findMany({
        where: {
          workspaceId,
          projectId: projectId ? { equals: projectId } : undefined,
          status: status ? { equals: status } : undefined,
          assigneeId: assigneeId ? { equals: assigneeId } : undefined,
          dueDate: dueDate ? { equals: dueDate } : undefined,
          name: {
            contains: search as string,
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        }
      });

      const projectIds = tasks.map((task) => task.projectId).filter(Boolean) as string[]
      const assigneeIds = tasks.map((task) => task.assigneeId).filter(Boolean) as string[]

      const projects = await db.projects.findMany({
        where: {
          id: {
            in: projectIds,
          },
        },
      });

      const members = await db.members.findMany({
        where: {
          id: {
            in: assigneeIds,
          },
        },
      });

      const assignees = await Promise.all(
        members.map(async (member) => {
          const user = await db.users.findUnique({
            where: {
              id: member.userId
            }
          })

          return {
            ...member,
            name: (user?.name || user?.email) ?? '',
            email: user?.email ?? '',
          }
        })
      );

      const populatedTasks = tasks.map((task) => {
        const project = projects.find(
          (project) => project.id === task.projectId,
        );
        const assignee = assignees.find(
          (assignee) => assignee.id === task.assigneeId,
        );

        if (!project || !assignee) {
          throw new Error(`Project or assignee does not exists`)
        }

        return {
          ...task,
          project: project,
          assignee: assignee
        };
      });

      return c.json({
        data: {
          total: tasks.length,
          documents: populatedTasks,
        }
      });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTaskSchema),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId
      } = c.req.valid("json");

      const member = await getMember({
        workspaceId: workspaceId as string,
        userId: user.id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const highestPositionTask = await db.tasks.findFirst({
        where: {
          status,
          workspaceId,
        },
        orderBy: {
          position: "asc",
        },
      });

      const newPosition =
        highestPositionTask ? highestPositionTask.position + 1000 : 1000;

      const task = await db.tasks.create({
        data: {
          name,
          status,
          workspaceId,
          projectId,
          dueDate: new Date(dueDate).toISOString(),
          assigneeId,
          position: newPosition
        },
      });

      return c.json({ data: task });
    }
  )
  .patch(
    "/:taskId",
    sessionMiddleware,
    zValidator("json", createTaskSchema.partial()),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        status,
        description,
        projectId,
        dueDate,
        assigneeId
      } = c.req.valid("json");
      const { taskId } = c.req.param();

      const existingTask = await db.tasks.findUnique({
        where: {
          id: taskId,
        },
      });

      if (!existingTask) {
        return c.json({ error: "Task not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingTask.workspaceId,
        userId: user.id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const task = await db.tasks.update({
        where: {
          id: taskId,
        },
        data: {
          name,
          status,
          projectId,
          dueDate: dueDate?.toISOString(),
          assigneeId,
          description,
        },
      });

      return c.json({ data: task });
    }
  )
  .get(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const currentUser = c.get("user");
      const { taskId } = c.req.param();

      const task = await db.tasks.findUnique({
        where: {
          id: taskId,
        }
      });

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const currentMember = await getMember({
        workspaceId: task.workspaceId,
        userId: currentUser.id,
      });

      if (!currentMember) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const project = await db.projects.findUnique({
        where: {
          id: task.projectId,
        },
      });

      if (!project) {
          return c.json({ error: "Project of task not found" }, 404);
      }

      const member = await db.members.findUnique({
        where: {
          id: task.assigneeId as string,
        },
      });

      if (!member) {
        return c.json({ error: "Member of task not found" }, 404);
      }

      const user = await db.users.findFirst({
        where: {
          id: member.userId,
        },
      });

      if (!user) {
        return c.json({ error: "User of task not found" }, 404);
      }

      const assignee = {
        ...member,
        name: user.name || user.email,
        email: user.email
      };

      return c.json({
        data: {
          ...task,
          project,
          assignee,
        },
      });
    }
  )
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            id: z.string(),
            status: z.nativeEnum($Enums.Status),
            position: z.number().int().positive().min(1000).max(1_000_000),
          })
        )
      })
    ),
    async (c) => {
      const user = c.get("user");
      const { tasks } = await c.req.valid("json");

      const tasksToUpdate = await db.tasks.findMany({
        where: {
          id: {
            in: tasks.map((task) => task.id),
          },
        },
      });

      const workspaceIds = new Set(tasksToUpdate.map(task => task.workspaceId));
      if (workspaceIds.size !== 1) {
        return c.json({ error: "All tasks must belong to the same workspace" })
      }

      const workspaceId = workspaceIds.values().next().value;

      if (!workspaceId) {
        return c.json({ error: "Workspace ID is required" }, 400);
      }

      const member = await getMember({
        workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { id, status, position } = task;
          return db.tasks.update({
            where: {
              id: id,
            },
            data: { status, position },
          });
        })
      );

      return c.json({ data: updatedTasks });
    }
  )

export default app;
