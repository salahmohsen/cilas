import { z } from "zod";

// ===== Centralized Error Messages =====
export const ErrorMessages = {
  // String validations
  string: {
    required: "This field is required",
    tooShort: (min: number) => `Must be at least ${min} characters`,
    tooLong: (max: number) => `Cannot exceed ${max} characters`,
  },

  // URL validations
  url: {
    invalid: "Please enter a valid URL",
    required: "URL is required",
  },

  // Email validations
  email: {
    invalid: "Please enter a valid email address",
    required: "Email address is required",
  },

  // Phone validations
  phone: {
    invalid: "Please enter a valid phone number",
    required: "Phone number is required",
  },

  // Password validations
  password: {
    weak: "Password is too weak",
    requirements: (requirements: {
      minLength?: number;
      requireUppercase?: boolean;
      requireSpecialChar?: boolean;
    }) =>
      `Password must be at least ${requirements.minLength || 8} characters with at least one number` +
      `${requirements.requireUppercase ? ", one uppercase letter" : ""}` +
      `${requirements.requireSpecialChar ? ", and one special character" : ""}`,
  },

  // Name validations
  name: {
    invalid: (name: string) =>
      `${name} can only contain letters, spaces, hyphens, and apostrophes`,
    tooShort: (name: string, min: number) => `${name} must be at least ${min} characters`,
    tooLong: (name: string, max: number) => `${name} cannot exceed ${max} characters`,
    required: (name: string) => `${name} is required`,
  },

  // Number validations
  number: {
    invalid: "Please enter a valid number",
    required: "This field is required",
    positive: "Number must be positive",
    negative: "Number must be negative",
    integer: "Number must be an integer",
    min: (min: number) => `Value must be at least ${min}`,
    max: (max: number) => `Value must be at most ${max}`,
    range: (min: number, max: number) => `Value must be between ${min} and ${max}`,
  },

  // Price validations
  price: {
    negative: "Price cannot be negative",
  },

  // File validations
  file: {
    invalidType: (types: string[]) => `File must be one of: ${types.join(", ")}`,
    tooLarge: (size: number) => `File must be less than ${size}MB`,
    required: "File is required",
  },

  // Date validations
  date: {
    invalid: "Please enter a valid date",
    required: "Date is required",
    future: "Date must be in the future",
    past: "Date must be in the past",
    min: (date: Date) => `Date must be on or after ${date.toLocaleDateString()}`,
    max: (date: Date) => `Date must be on or before ${date.toLocaleDateString()}`,
    range: (min: Date, max: Date) =>
      `Date must be between ${min.toLocaleDateString()} and ${max.toLocaleDateString()}`,
  },

  // Time slot validations
  timeSlot: {
    endAfterStart: "End time must be after start time",
    sameDay: "Start and end times must be on the same day",
    minDuration: (minutes: number) => `Time slot must be at least ${minutes} minutes`,
  },

  // Date range validations
  dateRange: {
    endAfterStart: "End date must be after start date",
    minDuration: (days: number) => `Date range must be at least ${days} days`,
    maxDuration: (days: number) => `Date range must be at most ${days} days`,
  },

  // Boolean validations
  boolean: {
    required: "This field is required",
  },

  // Select options validations
  select: {
    required: "At least one option is required",
  },
};

// ===== Basic Transformers =====
export const emptyStringToNull = z.literal("").transform(() => null);
export const emptyStringTo = <T>(value: T) => z.literal("").transform(() => value);

// ===== String Validation =====

const isZodString = (schema: z.ZodTypeAny): schema is z.ZodString => {
  return schema instanceof z.ZodString;
};

export const string = () => {
  const base = z.string().trim();

  return {
    required: base.min(1, { message: ErrorMessages.string.required }),
    optional: base.min(1).nullable().or(emptyStringToNull),
    withDefault: (defaultValue: string) => base.min(1).or(emptyStringTo(defaultValue)),
    minLength: (min: number) =>
      base.min(min, { message: ErrorMessages.string.tooShort(min) }),
    maxLength: (max: number) =>
      base.max(max, { message: ErrorMessages.string.tooLong(max) }),
    slug: (max?: number) =>
      base
        .min(1, { message: ErrorMessages.string.required })
        .max(max ?? 100, { message: ErrorMessages.string.tooLong(max ?? 100) })
        .transform((val) => val.trim().toLowerCase().replace(/\s+/g, "-")),
  };
};

// ===== URL Validation =====
export const url = () => {
  return {
    required: z
      .string()
      .url({ message: ErrorMessages.url.invalid })
      .trim()
      .min(1, { message: ErrorMessages.url.required }),
    optional: z
      .string()
      .url({ message: ErrorMessages.url.invalid })
      .nullable()
      .or(emptyStringToNull),
    withDefault: (defaultValue: string) =>
      z
        .string()
        .url({ message: ErrorMessages.url.invalid })
        .or(emptyStringTo(defaultValue)),
  };
};

// ===== Email Validation =====
export const email = () => ({
  required: z
    .string()
    .email({ message: ErrorMessages.email.invalid })
    .trim()
    .min(1, { message: ErrorMessages.email.required }),
  optional: z
    .string()
    .email({ message: ErrorMessages.email.invalid })
    .or(emptyStringToNull),
  withDefault: (defaultValue: string) =>
    z
      .string()
      .email({ message: ErrorMessages.email.invalid })
      .or(emptyStringTo(defaultValue)),
});

// ===== Phone Number Validation =====
const PHONE_REGEX = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
export const phone = () => ({
  required: z
    .string()
    .regex(PHONE_REGEX, { message: ErrorMessages.phone.invalid })
    .trim(),
  optional: z
    .string()
    .regex(PHONE_REGEX, { message: ErrorMessages.phone.invalid })
    .or(emptyStringToNull),
  withDefault: (defaultValue: string) =>
    z
      .string()
      .regex(PHONE_REGEX, { message: ErrorMessages.phone.invalid })
      .or(emptyStringTo(defaultValue)),
});

// ===== Password Validation =====
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[\w!@#$%^&*]{8,}$/;
const SIMPLE_PASSWORD_REGEX = /^(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;

export const password = (options?: {
  minLength?: number;
  requireUppercase?: boolean;
  requireSpecialChar?: boolean;
  customRegex?: RegExp;
}) => {
  const minLength = options?.minLength || 8;
  const errorMessage = ErrorMessages.password.requirements({
    minLength,
    requireUppercase: options?.requireUppercase,
    requireSpecialChar: options?.requireSpecialChar,
  });

  let regex = SIMPLE_PASSWORD_REGEX;
  if (options?.requireUppercase && options?.requireSpecialChar) {
    regex = PASSWORD_REGEX;
  } else if (options?.customRegex) {
    regex = options.customRegex;
  }

  return z
    .string()
    .regex(regex, { message: errorMessage })
    .min(minLength, { message: errorMessage });
};

// ===== Name Validation =====
export const name = (
  inputName: string = "Name",
  options?: {
    minLength?: number;
    maxLength?: number;
    allowNonLatin?: boolean;
  },
) => {
  const min = options?.minLength || 2;
  const max = options?.maxLength || 50;
  const regex = options?.allowNonLatin ? /^[\p{L}\s'-]+$/u : /^[a-zA-Z\s'-]+$/;

  return z
    .string()
    .min(min, ErrorMessages.name.tooShort(inputName, min))
    .max(max, ErrorMessages.name.tooLong(inputName, max))
    .regex(regex, ErrorMessages.name.invalid(inputName))
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, ErrorMessages.name.required(inputName));
};

// ===== Number Validation =====
export const number = () => ({
  required: z.coerce.number({
    message: ErrorMessages.number.required,
  }),

  optional: z.coerce.number().nullable().optional(),
  integer: z.coerce.number().int(ErrorMessages.number.integer),
  positive: z.coerce.number().positive(ErrorMessages.number.positive),
  negative: z.coerce.number().negative(ErrorMessages.number.negative),
  min: (min: number) => z.coerce.number().min(min, ErrorMessages.number.min(min)),
  max: (max: number) => z.coerce.number().max(max, ErrorMessages.number.max(max)),
  range: (min: number, max: number) =>
    z.coerce
      .number()
      .min(min, ErrorMessages.number.min(min))
      .max(max, ErrorMessages.number.max(max)),
});

// ===== File Validation =====
export const file = (options?: { maxSizeInMB?: number; acceptedTypes?: string[] }) => {
  const maxSize = (options?.maxSizeInMB || 5) * 1024 * 1024; // Convert MB to bytes
  const types = options?.acceptedTypes || ["image/jpeg", "image/jpg", "image/png"];

  return {
    required: z
      .instanceof(File)
      .optional()
      .refine((file) => file && types.includes(file.type), {
        message: ErrorMessages.file.invalidType(types),
      })
      .refine((file) => file && file.size <= maxSize, {
        message: ErrorMessages.file.tooLarge(options?.maxSizeInMB || 5),
      }),

    optional: z
      .instanceof(File)
      .refine((file) => types.includes(file.type), {
        message: ErrorMessages.file.invalidType(types),
      })
      .refine((file) => file.size <= maxSize, {
        message: ErrorMessages.file.tooLarge(options?.maxSizeInMB || 5),
      })
      .or(z.string().url().nullable())
      .or(emptyStringToNull)
      .or(
        z.instanceof(File).transform((val) => {
          if (val instanceof File && val.size === 0) return null;
          return val;
        }),
      ),
  };
};

// ===== Date Validation =====
export const date = () => {
  const baseValidator = z.date({
    required_error: ErrorMessages.date.required,
    invalid_type_error: ErrorMessages.date.invalid,
  });

  return {
    required: baseValidator,
    optional: baseValidator.nullable().optional(),
    future: baseValidator.refine((date) => date > new Date(), {
      message: ErrorMessages.date.future,
    }),
    past: baseValidator.refine((date) => date < new Date(), {
      message: ErrorMessages.date.past,
    }),
    min: (minDate: Date) =>
      baseValidator.refine((date) => date >= minDate, {
        message: ErrorMessages.date.min(minDate),
      }),
    max: (maxDate: Date) =>
      baseValidator.refine((date) => date <= maxDate, {
        message: ErrorMessages.date.max(maxDate),
      }),
    range: (minDate: Date, maxDate: Date) =>
      baseValidator.refine((date) => date >= minDate && date <= maxDate, {
        message: ErrorMessages.date.range(minDate, maxDate),
      }),
  };
};

// ===== Time Slot Validation =====
export const timeSlot = () => {
  const base = z.object({
    from: z.date({ invalid_type_error: ErrorMessages.date.invalid }),
    to: z.date({ invalid_type_error: ErrorMessages.date.invalid }),
  });

  // Create a comprehensive validator that chains all conditions
  const validator = base
    // 1. Ensure start < end
    .refine((data) => data.from < data.to, {
      message: ErrorMessages.timeSlot.endAfterStart,
      path: [],
    });

  // 2. Add same day validation as an option
  const withSameDay = validator.refine(
    (data) => {
      const from = data.from;
      const to = data.to;
      return (
        from.getFullYear() === to.getFullYear() &&
        from.getMonth() === to.getMonth() &&
        from.getDate() === to.getDate()
      );
    },
    {
      message: ErrorMessages.timeSlot.sameDay,
      path: [],
    },
  );

  // 3. Create a function to add minimum duration validation
  const withMinDuration = (minutes: number) =>
    validator.refine(
      (data) => {
        const durationMs = data.to.getTime() - data.from.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        return durationMinutes >= minutes;
      },
      {
        message: ErrorMessages.timeSlot.minDuration(minutes),
        path: [],
      },
    );

  // 4. Create a function that combines same day and min duration
  const withSameDayAndMinDuration = (minutes: number) =>
    withSameDay.refine(
      (data) => {
        const durationMs = data.to.getTime() - data.from.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        return durationMinutes >= minutes;
      },
      {
        message: ErrorMessages.timeSlot.minDuration(minutes),
        path: [],
      },
    );

  return {
    base: validator,
    sameDay: withSameDay,
    minDuration: withMinDuration,
    sameDayWithMinDuration: withSameDayAndMinDuration,
  };
};

// ===== Date Range Validation =====
export const dateRange = () => {
  const baseValidator = z.object({
    from: z.date({ invalid_type_error: ErrorMessages.date.invalid }),
    to: z.date({ invalid_type_error: ErrorMessages.date.invalid }),
  });

  return {
    required: baseValidator.refine((data) => data.to > data.from, {
      message: ErrorMessages.dateRange.endAfterStart,
      path: ["to"],
    }),
    minDuration: (days: number) =>
      baseValidator.refine(
        (data) => {
          const durationMs = data.to.getTime() - data.from.getTime();
          const durationDays = durationMs / (1000 * 60 * 60 * 24);
          return durationDays >= days;
        },
        {
          message: ErrorMessages.dateRange.minDuration(days),
          path: ["to"],
        },
      ),
    maxDuration: (days: number) =>
      baseValidator.refine(
        (data) => {
          const durationMs = data.to.getTime() - data.from.getTime();
          const durationDays = durationMs / (1000 * 60 * 60 * 24);
          return durationDays <= days;
        },
        {
          message: ErrorMessages.dateRange.maxDuration(days),
          path: ["to"],
        },
      ),
  };
};

// ===== Boolean Validation =====
export const boolean = () => {
  return {
    required: z.boolean({
      required_error: ErrorMessages.boolean.required,
      invalid_type_error: ErrorMessages.boolean.required,
    }),
    optional: z
      .boolean({
        required_error: ErrorMessages.boolean.required,
        invalid_type_error: ErrorMessages.boolean.required,
      })
      .optional()
      .or(emptyStringToNull),
    stringToBoolean: z
      .string()
      .refine((val) => val === "true" || val === "false", {
        message: "Value must be exactly 'true' or 'false'",
      })
      .transform((val) => val === "true"),
  };
};

// ===== Select Options Validation =====
export const selectOptions = () => {
  const optionShape = z.object({
    label: z.string(),
    value: z.string(),
    disable: z.boolean().optional(),
  });

  return {
    required: z.array(optionShape).min(1, ErrorMessages.select.required),
    optional: z.array(optionShape).or(emptyStringToNull),
    single: optionShape.or(emptyStringToNull),
  };
};

// ===== Helper Functions =====
export const safeJsonParse = <T>(value: unknown, errorMessage: string): T => {
  if (!value || typeof value !== "string") {
    throw new Error(`${errorMessage} Invalid input.`);
  }

  try {
    return JSON.parse(value) as T;
  } catch (e) {
    throw new Error(
      `${errorMessage} ${e instanceof Error ? e.message : "Unknown parsing error"}`,
    );
  }
};

export const convertToDate = (
  value: FormDataEntryValue | null,
  errorMsg: string,
  state?: "from" | "to",
): Date => {
  try {
    if (!state) {
      const date = new Date(value as any);
      if (isNaN(date.getTime())) throw new Error(errorMsg);
      return date;
    } else {
      const parsed = safeJsonParse(value, errorMsg);
      return new Date(parsed[state]);
    }
  } catch (error) {
    console.error("Date conversion error:", error);
    throw new Error(errorMsg);
  }
};

export function isImageFile(data: File | undefined): boolean {
  if (!data) return true; // Allow undefined
  if (data.size === 0) return true; // Allow no image sent
  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png"];
  return acceptedTypes.includes(data.type);
}
