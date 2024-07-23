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
    title: required_string,
    content: required_string,
    fellowId: required_string,
    category: required_string,
    featuredImage: optional_file,
    attendance: required_string,
    isRegistrationOpen: required_boolean,
    suggestedPrice: z.array(z.number(), z.number()).nonempty(),
    timeSlot: required_timeSlot,
    days: optional_selectOptions,
    applyUrl: optional_url,
    startDate: required_date,
    endDate: required_date,
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
  title: "",
  content: "",
  fellowId: "",
  category: "",
  image: "",
  attendance: "",
  isRegistrationOpen: "",
  suggestedPrice: [2000, 3000],
  timeSlot: {
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(0, 0, 0, 0)),
  },
  days: [],
  courseFlowUrl: "",
  applyUrl: "",
  startDate: "",
  endDate: "",
};
