import { z } from "zod";

export type FormInputs = z.infer<typeof createCourseSchema>;
export const createCourseSchema = z
  .object({
    enTitle: z.string().trim().optional(),
    arTitle: z.string().trim().optional(),
    enContent: z.string().trim().optional(),
    arContent: z.string().trim().optional(),
    authorId: z.string().regex(/^\d+$/),
    imageUrl: z.string().url().optional(),
    category: z.string(),
    attendance: z.enum(["offline", "online", "hybrid"]),
    registrationStatus: z.enum(["open", "closed"]),
    price: z.string().regex(/^\d+$/).optional(),
    sessionStartTime: z.date(),
    sessionEndTime: z.date(),
    days: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        disable: z.boolean().optional(),
      }),
    ),
    courseFlowUrl: z.string().url(),
    applyUrl: z.string().url().optional(),
    dateRange: z.object(
      {
        from: z.date(),
        to: z.date(),
      },
      {
        required_error: "Please select a date range",
      },
    ),
  })
  .refine((data) => data.dateRange.from < data.dateRange.to, {
    path: ["dateRange"],
    message: "From date must be before to date",
  })
  .refine((data) => data.enTitle || data.arTitle, {
    path: ["enTitle"],
    message: "At least one English or Arabic title is required",
  })
  .refine((data) => data.enContent || data.arContent, {
    path: ["enContent"],
    message: "At least one English or Arabic content is required",
  });
