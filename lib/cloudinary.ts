"use server";
import { v2 as cloudinary } from "cloudinary";

const requiredEnvVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not set`);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function cloudinaryUploader(imageData) {
  const image = imageData.get("image");
  const folder = imageData.get("folder");

  if (!image || !folder) {
    throw new Error("No file or folder provided");
  }
  let imageBlob = image as Blob;
  // if (!(image instanceof Blob || image instanceof File)) {
  //   try {
  //     imageBlob = await fetch(image).then((res) => res.blob());
  //   } catch (error) {
  //     throw new Error("Invalid image type");
  //   }
  // } else {
  //   imageBlob = image;
  // }

  let imageBuffer;
  try {
    imageBuffer = await imageBlob.arrayBuffer();
  } catch (error) {
    throw new Error("Error reading image buffer");
  }

  const mime = imageBlob.type;
  const encoding = "base64";
  const base64Data = Buffer.from(imageBuffer).toString("base64");
  const fileUri = `data:${mime};${encoding},${base64Data}`;

  let image_url;
  try {
    image_url = await cloudinary.uploader.upload(fileUri, {
      folder: folder,
    });
  } catch (error) {
    console.error("Upload error:", error);
    throw new Error("Failed to upload image");
  }

  if (!image_url || !image_url.secure_url) {
    throw new Error("Failed to get secure URL from Cloudinary response");
  }

  return image_url.secure_url;
}
