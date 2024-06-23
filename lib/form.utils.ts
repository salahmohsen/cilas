import { z } from "zod";
import { cloudinaryUploader } from "./cloudinary";
import { isURL } from "./utils";

// Zod Validation

const emptyStringToNull = z.literal("").transform(() => null);

// Validate Strings
export const required_string = z
  .string()
  .trim()
  .min(1, { message: "Required" });
export const optional_string = z.string().min(1).or(emptyStringToNull);
export const required_url = z
  .string()
  .url()
  .trim()
  .min(1, { message: "Required" });
export const optional_url = z.string().url().min(1).or(emptyStringToNull);
export const required_email = z
  .string()
  .email()
  .min(1, { message: "Please provide a valid email." });
export const optional_email = z.string().min(1).or(emptyStringToNull);

export const required_password = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message:
      "Minimum eight characters, at least one letter and one number required.",
  })
  .min(8, {
    message:
      "Password must be at least 8 characters long, and include at least one letter, one number, and one special character.",
  });

// validating numbers
export const required_number = z
  .string()
  .regex(/^\d+$/, { message: "Required" });
export const optional_number = z
  .string()
  .regex(/^\d+$/, { message: "Required" })
  .optional()
  .or(emptyStringToNull);

// validating other types
export const optional_file = z
  .instanceof(File)
  .refine((val: any) => isImageFile(val), {
    message: "Please select a valid image type",
  })
  .or(emptyStringToNull)
  .or(z.string().url().optional());

export const optional_days = z
  .array(
    z.object({
      label: z.string(),
      value: z.string(),
      disable: z.boolean().optional(),
    }),
  )
  .optional();

export const required_timeSlot = z
  .object({ from: z.date(), to: z.date() })
  .refine((data) => data.from.getTime() !== data.to.getTime(), {
    message: "Required",
  });

export const required_dateRange = z
  .object({
    from: z.date(),
    to: z.date(),
  })
  .refine((data) => data.from.getTime() !== data.to.getTime(), {
    message: "Required",
  });

export const required_boolean = z.boolean({
  required_error: "Required",
  invalid_type_error: "Required",
});

// Helper functions

export const convertToDate = (value: string, state: "from" | "to") => {
  return new Date(JSON.parse(value)[state]);
};

export const convertToJson = (value: string) => {
  return JSON.parse(value) as {
    value: string;
    label: string;
  }[];
};

export function isImageFile(data: File | undefined): boolean {
  if (!data) return true; // Allow undefined
  if (data.size === 0) return true; // Allow no image sent
  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const fileType = data.type;

  // Check if the file type is in the accepted list
  return acceptedTypes.includes(fileType);
}

export const uploadImage = async (
  image: unknown,
): Promise<string | undefined | Error> => {
  if (image === "") return undefined;
  if (typeof image === "string" && isURL(image)) return image;
  if (image instanceof File && image.size === 0) return undefined;

  const imageData = new FormData();
  imageData.append("image", image as Blob);
  imageData.append("folder", "courses");

  try {
    const imageUrl: string = await cloudinaryUploader(imageData);
    return imageUrl;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  return undefined;
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
    url.slice(0, uploadIndex) +
    imageQuality[quality] +
    "/" +
    url.slice(uploadIndex);
  return newUrl;
};
