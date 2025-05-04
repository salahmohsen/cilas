import { z } from "zod";

import { cleanHtml } from "@/lib/utils";
import {
  boolean,
  date,
  ErrorMessages,
  file,
  number,
  selectOptions,
  string,
  timeSlot,
  url,
} from "@/lib/utils/zod.utils";

const courseSchema = {
  schema: z
    .object({
      enTitle: string().optional.transform(cleanHtml),
      arTitle: string().optional.transform(cleanHtml),
      enContent: string().optional.transform(cleanHtml),
      arContent: string().optional.transform(cleanHtml),
      slug: string().slug(100),
      fellowId: string().required,
      category: number().required,
      featuredImage: file().optional,
      attendance: z.preprocess(
        (val) => (typeof val === "string" ? val.toLowerCase() : val),
        z.enum(["online", "offline", "hybrid"], {
          message: ErrorMessages.string.required,
        }),
      ),
      isRegistrationOpen: boolean().required,
      suggestedPrice: z.tuple([z.number(), z.number()]),
      timeSlot: timeSlot().sameDayWithMinDuration(30),
      days: selectOptions().optional,
      applyUrl: url().optional,
      startDate: date().required,
      endDate: date().required,
    })
    .refine((data) => data.arTitle || data.enTitle, {
      path: ["arTitle"],
      message: "At least one English or Arabic title is required.",
    })
    .refine((data) => data.arTitle || data.enTitle, {
      path: ["enTitle"],
      message: "At least one English or Arabic title is required.",
    })
    .refine((data) => data.enContent || data.arContent, {
      path: ["arContent"],
      message: "At least one English or Arabic content is required",
    })
    .refine((data) => data.enContent || data.arContent, {
      path: ["enContent"],
      message: "At least one English or Arabic content is required",
    })
    .refine((data) => data.endDate > data.startDate, {
      path: ["startDate"],
      message: "Start date must be earlier than end date",
    })
    .refine((data) => data.endDate > data.startDate, {
      path: ["endDate"],
      message: "End date must be after start date",
    }),
  defaults: {
    enTitle: "",
    arTitle: "",
    enContent: "",
    arContent: "",
    slug: "",
    fellowId: "",
    category: "",
    featuredImage: "",
    attendance: "",
    isRegistrationOpen: false,
    suggestedPrice: [2000, 3000],
    timeSlot: {
      from: new Date(new Date().setHours(0, 0, 0, 0)),
      to: new Date(new Date().setHours(0, 0, 0, 0)),
    },
    days: [],
    applyUrl: "",
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
  },
};

export const CourseFormStateSchema = z.object({
  isDraft: boolean().stringToBoolean,
  editMode: boolean().stringToBoolean,
  courseId: number().optional,
});

export type CourseSchema = z.infer<typeof courseSchema.schema>;
export default courseSchema;
