import {
  required_string,
  optional_string,
  required_boolean,
  optional_url,
  optional_days,
  required_timeSlot,
  required_dateRange,
  optional_file,
  optional_number,
} from "@/lib/form.utils";

import { z } from "zod";

export const courseSchema = z
  .object({
    enTitle: optional_string,
    arTitle: optional_string,
    enContent: optional_string,
    arContent: optional_string,
    authorId: required_string,
    category: required_string,
    image: optional_file,
    attendance: required_string,
    isRegistrationOpen: required_boolean,
    price: optional_number,
    timeSlot: required_timeSlot,
    days: optional_days,
    courseFlowUrl: optional_url,
    applyUrl: optional_url,
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

// Default Values for Course Form
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
