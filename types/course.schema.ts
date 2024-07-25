import {
  required_string,
  optional_string,
  required_boolean,
  optional_url,
  optional_selectOptions,
  required_timeSlot,
  optional_file,
  optional_number,
  required_date,
} from "@/lib/zodValidation.utils";

import { z } from "zod";

export const courseSchema = z
  .object({
    enTitle: optional_string,
    arTitle: optional_string,
    enContent: optional_string,
    arContent: optional_string,
    fellowId: required_string,
    category: required_string,
    featuredImage: optional_file,
    attendance: required_string,
    isRegistrationOpen: required_boolean,
    suggestedPrice: z.tuple([z.number(), z.number()]),
    timeSlot: required_timeSlot,
    days: optional_selectOptions,
    applyUrl: optional_url,
    startDate: required_date,
    endDate: required_date,
  })
  .refine((data) => data.arTitle || data.enTitle, {
    path: ["enTitle"],
    message: "At least one English or Arabic title is required",
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
  })
  .refine((data) => data.endDate > data.startDate, {
    path: ["startDate"],
    message: "End date must be later than the start date",
  })
  .refine((data) => data.endDate > data.startDate, {
    path: ["endDate"],
    message: "End date must be later than the start date",
  });

export type CourseSchema = z.infer<typeof courseSchema>;

// Default Values for Course Form
export const courseFormDefaultValues: CourseSchema | {} = {
  enTitle: "",
  arTitle: "",
  enContent: "",
  arContent: "",
  fellowId: "",
  category: "",
  featuredImage: "",
  attendance: "",
  isRegistrationOpen: "",
  suggestedPrice: [2000, 3000],
  timeSlot: {
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(0, 0, 0, 0)),
  },
  days: [],
  applyUrl: "",
  startDate: "",
  endDate: "",
};
