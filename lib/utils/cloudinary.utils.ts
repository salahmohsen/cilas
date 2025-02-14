import { cloudinaryUploader } from "../actions/cloudinary";
import { isURL } from "./utils";

export enum UploadingFolder {
  courses = "courses",
  avatar = "avatar",
  feature = "featured",
}

export const uploadImage = async (
  image: unknown,
  folder: UploadingFolder,
): Promise<string | undefined | Error> => {
  if (image === "") return;
  if (typeof image === "string" && isURL(image)) return image as string;
  if (image instanceof File && image.size === 0) return;

  const imageData = new FormData();
  imageData.append("image", image as Blob);
  imageData.append("folder", folder);

  try {
    const imageUrl: string = await cloudinaryUploader(imageData);
    return imageUrl;
  } catch (error) {
    if (error instanceof Error) return error;
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
