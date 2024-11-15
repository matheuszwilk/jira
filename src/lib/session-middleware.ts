import "server-only";
import { createMiddleware } from "hono/factory";

import {createSessionClient} from "@/lib/auth";
import {users} from "@prisma/client";

type AdditionalContext = {
  Variables: {
    user: Omit<users, 'password'>
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(
  async (c, next) => {
    const {account} = await createSessionClient()

    if (account.get() === null) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", account.get());

    await next();
  }
);
