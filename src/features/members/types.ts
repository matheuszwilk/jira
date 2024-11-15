import { $Enums } from '@prisma/client';

export const MemberRole = { ...$Enums.Role }

export type Member = {
  workspaceId: string;
  userId: string;
  id: string;
  name: string;
  email: string;
  role: $Enums.Role;
};
