import {Hono} from "hono";
import {sessionMiddleware} from "@/lib/session-middleware";
import {IMAGES_BUCKET_ID} from "@/config";

const app = new Hono()
  .get("/:fileId", sessionMiddleware, async (c) => {
    const storage = c.get("storage");
    const {fileId} = c.req.param();

    const result = await storage.getFileView(
      IMAGES_BUCKET_ID,
      fileId
    );

    return c.body(result)
  })

export default app;
