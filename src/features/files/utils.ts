import {ID, Storage} from "node-appwrite";
import {APP_URL, IMAGES_BUCKET_ID} from "@/config";

interface UploadFileProps {
  storage: Storage;
  image: string | File | undefined;
}

export const uploadFile = async ({storage, image}: UploadFileProps): Promise<string | File | undefined> => {
  let imageUrl = image
  if (image instanceof File) {
    const file = await storage.createFile(
      IMAGES_BUCKET_ID,
      ID.unique(),
      image
    )

    imageUrl = `${APP_URL}/api/files/${file.$id}`
  }

  return imageUrl
}