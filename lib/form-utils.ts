import { z } from "zod";

// https://gist.github.com/bennettdams/463c804fcfde0eaa888eaa4851c668a1
const emptyStringToUndefined = z.literal("").transform(() => undefined);

function isImageFile(data: File | undefined): boolean {
  if (!data) return true; // Allow undefined
  if (data.size === 0) return true; // Allow no image sent
  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const fileType = data.type;

  // Check if the file type is in the accepted list
  return acceptedTypes.includes(fileType);
}

export const string = (state: "optional" | "required", type?: "url") => {
  if (!state) return;
  if (state && !type) {
    return state === "required"
      ? z.string().trim().min(1, { message: "Required" })
      : z.string().trim().optional().or(emptyStringToUndefined);
  }
  if (state && type) {
    return state === "required" && type === "url"
      ? z.string().url().trim().min(1, { message: "Required" })
      : z.string().url().trim().optional().or(emptyStringToUndefined);
  }
};

export const number = (state: "optional" | "required") =>
  state === "required"
    ? z
        .number()
        .min(1, { message: "Required" })
        .refine((data) => data === 0 || data !== "", { message: "Required" })
    : z.number().optional().or(emptyStringToUndefined);

export const required_timeSlot = z
  .object({ from: z.date(), to: z.date() })
  .refine((data) => data.from.getTime() !== data.to.getTime(), {
    message: "Required",
  });

export const optional_file = z
  .instanceof(File)
  .refine((val: any) => isImageFile(val), {
    message: "Please select a valid image type",
  })
  .or(emptyStringToUndefined);

export const optional_days = z
  .array(
    z.object({
      label: z.string(),
      value: z.string(),
      disable: z.boolean().optional(),
    }),
  )
  .optional();

export const required_dateRange = z
  .object({
    from: z.date(),
    to: z.date(),
  })
  .refine((data) => data.from.getTime() !== data.to.getTime(), {
    message: "Required",
  });
