import {workspaces} from '@prisma/client'
export type Workspace = Omit<workspaces, 'createdAt' | 'updatedAt'> & {
    createdAt: string, updatedAt: string
};
