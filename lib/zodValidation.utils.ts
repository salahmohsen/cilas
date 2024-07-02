import { z } from "zod";

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
  .regex(/^(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, {
    message: "Password must be Minimum 8 characters, with at least one number.",
  })
  .min(8, {
    message: "Password must be Minimum 8 characters, with at least one number.",
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
  .or(z.string().url().nullable().optional())
  .or(emptyStringToNull);

export const optional_days = z
  .array(
    z.object({
      label: z.string(),
      value: z.string(),
      disable: z.boolean().optional(),
    }),
  )
  .nullable();

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

export const required_date = z.date({
  required_error: "Required",
  invalid_type_error: "Required",
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
