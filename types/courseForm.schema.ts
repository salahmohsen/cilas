import {
  number,
  optional_days,
  optional_file,
  required_dateRange,
  required_timeSlot,
  string,
} from "@/lib/form-utils";

import { z } from "zod";

export const courseFormSchema = z
  .object({
    enTitle: string("optional")!,
    arTitle: string("optional")!,
    enContent: string("optional")!,
    arContent: string("optional")!,
    authorId: number("required"),
    category: string("required")!,
    image: optional_file,
    attendance: string("required")!,
    isRegistrationOpen: z.boolean(),
    price: number("optional").refine((data) => data, { message: "Required" }),
    timeSlot: required_timeSlot,
    days: optional_days,
    courseFlowUrl: string("required", "url")!,
    applyUrl: string("optional", "url")!,
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

export const courseFormDefaultValues: z.infer<typeof courseFormSchema> = {
  enTitle: "",
  enContent: "",
  arTitle: "",
  arContent: "",
  authorId: 0,
  category: "",
  image: "",
  attendance: "",
  registrationStatus: "",
  price: 0,
  timeSlot: {
    from: new Date(),
    to: new Date(),
  },
  days: [],
  courseFlowUrl: "",
  applyUrl: "",
  dateRange: {
    from: new Date(),
    to: new Date(),
  },
};
