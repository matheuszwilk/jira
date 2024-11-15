import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE } from "@/features/auth/constants";
import db from "../../lib/db";
import jsonwebtoken from "jsonwebtoken";
import { users } from "@prisma/client";

const PRIVATE_KEY = '4153513c-0514-4d0b-89b1-325e2434f2b1'

export const AUTH_EXPIRES_IN =  60 * 60 * 24 * 30

export async function createSessionClient() {
  const session = await cookies().get(AUTH_COOKIE);

  if (!session || !session.value) {
    throw new Error("Unauthorized");
  }

  const payload = jsonwebtoken.verify(session.value, PRIVATE_KEY)
  const userId = typeof payload !== "string" && payload.user.id

  const user = await db.users.findFirst({
    where: {
      id: userId,
    },
    omit: {
      password: true
    }
  })

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    get account() {
      return {
        get () {
          return user
        }
      }
    }
  }
}

export function createSession (user: Omit<users, 'password'>) {
  return jsonwebtoken.sign(
    { user: { id: user.id } },
    PRIVATE_KEY,
    { expiresIn: AUTH_EXPIRES_IN }
  )
}
