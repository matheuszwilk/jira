import {Hono} from "hono";
import {sessionMiddleware} from "@/lib/session-middleware";
import { stream } from 'hono/streaming'
import { getFile } from "../utils";

const app = new Hono()
  .get("/:fileId", sessionMiddleware, async (c) => {
    return stream(c, async (stream) => {
      const file = await getFile(c.req.param().fileId);

      for await (const chunk of file) {
        stream.write(chunk);
      }
    });
  })

export default app;
