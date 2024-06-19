import {
  number,
  optional_days,
  optional_file,
  required_boolean,
  required_dateRange,
  required_timeSlot,
  string,
} from "@/lib/form.utils";

import { z } from "zod";

export const courseSchema = z
  .object({
    enTitle: string("optional", "text") as z.ZodString,
    arTitle: string("optional", "text") as z.ZodString,
    enContent: string("optional", "text") as z.ZodString,
    arContent: string("optional", "text") as z.ZodString,
    authorId: string("required", "text") as z.ZodString,
    category: string("required", "text") as z.ZodString,
    image: optional_file,
    attendance: string("required", "text") as z.ZodString,
    isRegistrationOpen: required_boolean,
    price: number("optional"),
    timeSlot: required_timeSlot,
    days: optional_days,
    courseFlowUrl: string("required", "url") as z.ZodString,
    applyUrl: string("optional", "url") as z.ZodString,
    dateRange: required_dateRange,
  })

  .refine((data) => data.arTitle || data.enTitle, {
    path: ["enTitle"],
    message: "At least one English or Arabic title is required.",
  })

  .refine((data) => data.enContent || data.arContent, {
    path: ["enContent"],
    message: "At least one English or Arabic content is required",
  })
  .refine((data) => data.arTitle || data.enTitle, {
    path: ["arTitle"],
    message: "At least one English or Arabic title is required.",
  })

  .refine((data) => data.enContent || data.arContent, {
    path: ["arContent"],
    message: "At least one English or Arabic content is required",
  });

export const courseFormDefaultValues: z.infer<typeof courseSchema> | {} = {
  enTitle: "",
  enContent: "",
  arTitle: "",
  arContent: "",
  authorId: "",
  category: "",
  image: "",
  attendance: "",
  isRegistrationOpen: "",
  price: "",
  timeSlot: {
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(0, 0, 0, 0)),
  },
  days: [],
  courseFlowUrl: "",
  applyUrl: "",
  dateRange: {
    from: new Date(),
    to: new Date(),
  },
};
