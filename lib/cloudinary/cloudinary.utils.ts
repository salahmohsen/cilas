import { isURL } from "../utils/utils";
import { cloudinaryUploader } from "./cloudinary";

export enum UploadingFolder {
  courses = "courses",
  avatar = "avatar",
  feature = "featured",
}

export const uploadImage = async (
  image: unknown,
  folder: UploadingFolder,
): Promise<string | undefined> => {
  try {
    if (image === "" || image === null) return;
    if (typeof image === "string" && isURL(image)) return image;
    if (image instanceof File && image.size === 0) return;

    const imageData = new FormData();
    imageData.append("image", image as Blob);
    imageData.append("folder", folder);

    const imageUrl: string = await cloudinaryUploader(imageData);
    return imageUrl;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message || "Image Uploading Failed, please try again later!");
      throw new Error(error.message || "Image Uploading Failed, please try again later!");
    }
  }
};

export const cloudinary_quality = (
  url: string,
  quality: "original" | "best" | "good" | "eco" | "sensitive" | "low",
): string | undefined => {
  if (!isURL(url)) return undefined;
  const imageQuality = {
    original: "",
    best: "q_auto:best",
    good: "q_auto:good",
    eco: "q_auto:eco",
    sensitive: "q_auto:low:sensitive",
    low: "q_auto:low",
  };
  const uploadIndex = url.indexOf("upload/") + "upload/".length;
  if (!uploadIndex) return undefined;
  const newUrl =
    url.slice(0, uploadIndex) + imageQuality[quality] + "/" + url.slice(uploadIndex);
  return newUrl;
};
