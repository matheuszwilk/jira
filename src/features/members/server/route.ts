import { $Enums } from '@prisma/client';
import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";

import { getMember } from "../utils";
import db from "../../../../lib/db";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const members = await db.members.findMany({
        where: {
          workspaceId,
        }
      });

      const populatedMembers = await Promise.all(
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

      return c.json({
        data: {
          total: members.length,
          documents: populatedMembers
        }
      })
    }
  )
  .delete(
    "/:memberId",
    sessionMiddleware,
    async (c) => {
      const { memberId } = c.req.param();
      const user = c.get("user");

      const memberToDelete = await db.members.findUnique({
        where: {
          id: memberId,
        },
      });

      if (!memberToDelete) {
        return c.json({ error: "Member not found" }, 404);
      }

      const allMembersInWorkspace = await db.members.findMany({
        where: {
          workspaceId: memberToDelete.workspaceId,
        },
      });

      const member = await getMember({
        workspaceId: memberToDelete.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (
        member.id !== memberToDelete.id &&
        member.role !== $Enums.Role.ADMIN
      ) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.length === 1) {
        return c.json({ error: "Cannot delete the only member" }, 400);
      }

      await db.members.delete({
        where: {
          id: memberId,
        },
      });

      return c.json({ data: { id: memberToDelete.id } });
    }
  )
  .patch(
    "/:memberId",
    sessionMiddleware,
    zValidator("json", z.object({ role: z.nativeEnum($Enums.Role) })),
    async (c) => {
      const { memberId } = c.req.param();
      const { role } = c.req.valid("json");
      const user = c.get("user");

      const memberToUpdate = await db.members.findUnique({
        where: {
          id: memberId,
        },
      });

      if (!memberToUpdate) {
        return c.json({ error: "Member not found" }, 404);
      }

      const allMembersInWorkspace = await db.members.findMany({
        where: {
          workspaceId: memberToUpdate.workspaceId,
        },
      });

      const member = await getMember({
        workspaceId: memberToUpdate.workspaceId,
        userId: user.id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (member.role !== $Enums.Role.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.length === 1) {
        return c.json({ error: "Cannot downgrade the only member" }, 400);
      }

      await db.members.update({
        where: {
          id: memberId,
        },
        data: {
          role,
        },
      });

      return c.json({ data: { id: memberToUpdate.id } });
    }
  );

export default app;
