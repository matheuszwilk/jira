import prisma from "../../../lib/db";

interface GetMemberProps {
  workspaceId: string;
  userId: string;
}

export const getMember = async ({
  workspaceId,
  userId,
}: GetMemberProps) => {
  const member = await prisma.members.findFirst({
    where: {
      workspaceId,
      userId,
    }
  });

  return member;
};
