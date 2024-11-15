import { $Enums } from '@prisma/client';
import {z} from "zod";
import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import {endOfMonth, startOfMonth, subMonths} from "date-fns";

import {getMember} from "@/features/members/utils";

import {generateInviteCode} from "@/lib/utils";
import {sessionMiddleware} from "@/lib/session-middleware";

import {createWorkspaceSchema, updateWorkspaceSchema} from "../schemas";
import {uploadFile} from "@/features/files/utils";
import db from "../../../../lib/db";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");

    const members = await db.members.findMany({
      where: {
        userId: user.id,
      },
    });

    if (members.length === 0) {
      return c.json({data: []});
    }

    const workspaceIds = members.map((member) => member.workspaceId);

    const workspaces = await db.workspaces.findMany({
      where: {
        id: {
          in: workspaceIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return c.json({data: workspaces});
  })
  .get("/:workspaceId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const {workspaceId} = c.req.param();

    const member = await getMember({
      workspaceId,
      userId: user.id,
    });

    if (!member) {
      return c.json({error: "Unauthorized"}, 401);
    }

    const workspace = await db.workspaces.findUnique({
      where: {
        id: workspaceId,
      },
    });

    return c.json({data: workspace});
  })
  .get("/:workspaceId/info", sessionMiddleware, async (c) => {
    const {workspaceId} = c.req.param();

    const workspace = await db.workspaces.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    return c.json({
      data: {
        id: workspace.id,
        name: workspace.name,
        imageUrl: workspace.imageUrl,
      },
    });
  })
  .post(
    "/",
    zValidator("form", createWorkspaceSchema),
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");

      const {name, image} = c.req.valid("form");

      const imageUrl = await uploadFile(image)
      const workspace = await db.workspaces.create({
        data: {
          name,
          userId: user.id,
          imageUrl: imageUrl as string,
          inviteCode: generateInviteCode(6),
        }
      })

      await db.members.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: $Enums.Role.ADMIN,
        }
      })

      return c.json({data: workspace});
    }
  )
  .patch(
    "/:workspaceId",
    sessionMiddleware,
    zValidator("form", updateWorkspaceSchema),
    async (c) => {
      const user = c.get("user");

      const {workspaceId} = c.req.param();
      const {name, image} = c.req.valid("form");

      const member = await getMember({
        workspaceId,
        userId: user.id,
      });

      if (!member || member.role !== $Enums.Role.ADMIN) {
        return c.json({error: "Unauthorized"}, 401);
      }

      const imageUrl = await uploadFile(image)

      const workspace = await db.workspaces.update({
        where: {
          id: workspaceId,
        },
        data: {
          name,
          imageUrl: imageUrl as string,
        },
      });

      return c.json({data: workspace});
    }
  )
  .delete("/:workspaceId", sessionMiddleware, async (c) => {
    const user = c.get("user");

    const {workspaceId} = c.req.param();

    const member = await getMember({
      workspaceId,
      userId: user.id,
    });

    if (!member || member.role !== $Enums.Role.ADMIN) {
      return c.json({error: "Unauthorized"}, 401);
    }

    // TODO: Delete members, projects, and tasks

    await db.workspaces.delete({
      where: {
        id: workspaceId,
      },
    })

    return c.json({data: {id: workspaceId}});
  })
  .post("/:workspaceId/reset-invite-code", sessionMiddleware, async (c) => {
    const user = c.get("user");

    const {workspaceId} = c.req.param();

    const member = await getMember({
      workspaceId,
      userId: user.id,
    });

    if (!member || member.role !== $Enums.Role.ADMIN) {
      return c.json({error: "Unauthorized"}, 401);
    }

    const workspace = await db.workspaces.update({
      where: {
        id: workspaceId,
      },
      data: {
        inviteCode: generateInviteCode(6),
      },
    });

    return c.json({data: workspace});
  })
  .post(
    "/:workspaceId/join",
    sessionMiddleware,
    zValidator("json", z.object({code: z.string()})),
    async (c) => {
      const {workspaceId} = c.req.param();
      const {code} = c.req.valid("json");

      const user = c.get("user");

      const member = await getMember({
        workspaceId,
        userId: user.id,
      });

      if (member) {
        return c.json({error: "Already a member"}, 400);
      }

      const workspace = await db.workspaces.findUnique({
        where: {
          id: workspaceId,
        },
      });

      if (workspace?.inviteCode !== code) {
        return c.json({error: "Invalid invite code"}, 400);
      }

      await db.members.create({
        data: {
          workspaceId,
          userId: user.id,
          role: $Enums.Role.MEMBER,
        },
      });

      return c.json({data: workspace});
    }
  )
  .get("/:workspaceId/analytics", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const {workspaceId} = c.req.param();

    const member = await getMember({
      workspaceId,
      userId: user.id,
    });

    if (!member) {
      return c.json({error: "Unauthorized"}, 401);
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthTasks = await db.tasks.count({
      where: {
        workspaceId,
        createdAt: {
          gte: thisMonthStart.toISOString(),
          lte: thisMonthEnd.toISOString(),
        },
      },
    });

    const lastMonthTasks = await db.tasks.count({
      where: {
        workspaceId,
        createdAt: {
          gte: lastMonthStart.toISOString(),
          lte: lastMonthEnd.toISOString(),
        },
      },
    });

    const taskCount = thisMonthTasks;
    const taskDifference = taskCount - lastMonthTasks;

    const thisMonthAssignedTasks = await db.tasks.count({
      where: {
        workspaceId,
        assigneeId: member.id,
        createdAt: {
          gte: thisMonthStart.toISOString(),
          lte: thisMonthEnd.toISOString(),
        },
      },
    });

    const lastMonthAssignedTasks = await db.tasks.count({
      where: {
        workspaceId,
        assigneeId: member.id,
        createdAt: {
          gte: lastMonthStart.toISOString(),
          lte: lastMonthEnd.toISOString(),
        },
      },
    });

    const assignedTaskCount = thisMonthAssignedTasks;
    const assignedTaskDifference =
      assignedTaskCount - lastMonthAssignedTasks;

    const thisMonthIncompleteTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: {
          not: $Enums.Status.DONE,
        },
        createdAt: {
          gte: thisMonthStart.toISOString(),
          lte: thisMonthEnd.toISOString(),
        },
      },
    });

    const lastMonthIncompleteTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: {
          not: $Enums.Status.DONE,
        },
        createdAt: {
          gte: lastMonthStart.toISOString(),
          lte: lastMonthEnd.toISOString(),
        },
      },
    });

    const incompleteTaskCount = thisMonthIncompleteTasks;
    const incompleteTaskDifference =
      incompleteTaskCount - lastMonthIncompleteTasks;

    const thisMonthCompletedTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: $Enums.Status.DONE,
        createdAt: {
          gte: thisMonthStart.toISOString(),
          lte: thisMonthEnd.toISOString(),
        },
      },
    });

    const lastMonthCompletedTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: $Enums.Status.DONE,
        createdAt: {
          gte: lastMonthStart.toISOString(),
          lte: lastMonthEnd.toISOString(),
        },
      },
    });

    const completedTaskCount = thisMonthCompletedTasks;
    const completedTaskDifference =
      completedTaskCount - lastMonthCompletedTasks;

    const thisMonthOverdueTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: {
          not: $Enums.Status.DONE,
        },
        dueDate: {
          lt: now.toISOString(),
        },
        createdAt: {
          gte: thisMonthStart.toISOString(),
          lte: thisMonthEnd.toISOString(),
        },
      },
    });

    const lastMonthOverdueTasks = await db.tasks.count({
      where: {
        workspaceId,
        status: {
          not: $Enums.Status.DONE,
        },
        dueDate: {
          lt: now.toISOString(),
        },
        createdAt: {
          gte: lastMonthStart.toISOString(),
          lte: lastMonthEnd.toISOString(),
        },
      },
    });

    const overdueTaskCount = thisMonthOverdueTasks;
    const overdueTaskDifference =
      overdueTaskCount - lastMonthOverdueTasks;

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
  });

export default app;
