import { Regex } from "lucide-react";
import { ZodAny, ZodObject, infer, unknown, z } from "zod";

const emptyStringToUndefined = z.literal("").transform(() => undefined);

function isImageFile(data: File | undefined): boolean {
  if (!data) return true; // Allow undefined
  if (data.size === 0) return true; // Allow no image sent
  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const fileType = data.type;

  // Check if the file type is in the accepted list
  return acceptedTypes.includes(fileType);
}

export const string = (
  state: "optional" | "required",
  type: "url" | "text" | "email" | "password",
) => {
  if (!state || !type) return;

  if (type === "text") {
    return state === "required"
      ? (z.string().trim().min(1, { message: "Required" }) as z.ZodString)
      : z.string().min(1).or(emptyStringToUndefined);
  }
  if (type === "url") {
    return state === "required"
      ? (z.string().url().trim().min(1, { message: "Required" }) as z.ZodString)
      : z.string().url().min(1).or(emptyStringToUndefined);
  }

  if (type === "email") {
    return state === "required"
      ? (z
          .string()
          .email()
          .min(1, { message: "Please provide a valid email." }) as z.ZodString)
      : z.string().min(1).or(emptyStringToUndefined);
  }
  if (type === "password") {
    return z
      .string()
      .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
        message:
          "Minimum eight characters, at least one letter and one number required.",
      })
      .min(8, {
        message:
          "Password must be at least 8 characters long, and include at least one letter, one number, and one special character.",
      });
  }
};

export const number = (state: "optional" | "required") =>
  state === "required"
    ? (z.number().min(1, { message: "Required" }) as z.ZodNumber)
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

export const required_boolean = z
  .boolean({ required_error: "Required" })
  .or(
    z
      .string()
      .refine((data) => typeof data === "boolean", { message: "Required" }),
  );
