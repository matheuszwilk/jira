import { createSessionClient } from "@/lib/auth";
import db from "../../../lib/db";

export const getWorkspaces = async () => {
  const { account } = await createSessionClient();

  const user = await account.get();
  const members = await db.members.findMany({
    where: {
      userId: user.id
    }
  })

  if (members.length === 0) {
    return []
  }
  const workspaceIds = members.map((member) => member.workspaceId);

  const workspaces = await db.workspaces.findMany({
    where: {
      id: {
        in: workspaceIds
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return workspaces;
};
