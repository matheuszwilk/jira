import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import bcrypt from 'bcrypt';

import {AUTH_EXPIRES_IN, createSession} from "@/lib/auth";
import { sessionMiddleware } from "@/lib/session-middleware";
import { AUTH_COOKIE } from "../constants";
import { loginSchema, registerSchema } from "../schemas";
import prisma from "../../../../lib/db";
const app = new Hono()
  .get(
    "/current",
    sessionMiddleware,
    (c) => {
      const user = c.get("user");

      return c.json({ data: user });
    }
  )
  .post(
    "/login",
    zValidator("json", loginSchema),
    async (c) => {
      const { email, password } = c.req.valid("json");

      const user = await prisma.users.findFirst({
        where: {
          email
        }
      })

      if (!user) {
        throw new Error('User email does not exists')
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if(!isMatch) {
        throw new Error('User password is invalid')
      }

      const token = createSession(user)

      setCookie(c, AUTH_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: AUTH_EXPIRES_IN,
      });

      return c.json({ success: true });
    }
  )
  .post(
    "/register",
    zValidator("json", registerSchema),
    async (c) => {
      const { name, email, password } = c.req.valid("json");
      const hash = await bcrypt.hash(password, 10);
      const user = await prisma.users.create({
        data: {
          name, email, password: hash
        }
      })

      const token = createSession(user)

      setCookie(c, AUTH_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: AUTH_EXPIRES_IN,
      });

      return c.json({ success: true });
    }
  )
  .post("/logout", sessionMiddleware, async (c) => {
    deleteCookie(c, AUTH_COOKIE);

    return c.json({ success: true });
  });

export default app;
