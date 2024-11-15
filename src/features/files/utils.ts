import {
  APP_URL,
  MINIO_ACCESS_KEY, MINIO_BUCKET,
  MINIO_SECRET_KEY,
  MINIO_SERVER_PORT,
  MINIO_SERVER_URL
} from "@/config";
import * as Minio from 'minio'
import { Readable } from "stream";

const minioClient = new Minio.Client({
  endPoint: MINIO_SERVER_URL,
  port: Number(MINIO_SERVER_PORT),
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
})
interface UploadFileProps {
  image: string | File | undefined;
}

export const uploadFile = async (image: UploadFileProps['image']): Promise<string | File | undefined> => {
  let imageUrl = image
  if (image instanceof File) {
    const fileName = `${+new Date()}_${image.name}`

    await minioClient.putObject(MINIO_BUCKET, fileName, Buffer.from((await image.arrayBuffer())))

    imageUrl = `${APP_URL}/api/files/${fileName}`
  }

  return imageUrl
}

export const getFile = async (imageId: string): Promise<Readable> => {
  return minioClient.getObject(MINIO_BUCKET, imageId)
}