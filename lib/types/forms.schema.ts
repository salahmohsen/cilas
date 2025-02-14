import { z } from "zod";

import { Option } from "@/components/ui/multipleSelector";
import {
  optional_file,
  optional_selectOptions,
  optional_string,
  optional_tel,
  optional_url,
  required_boolean,
  required_date,
  required_email,
  required_number,
  required_string,
  required_timeSlot,
} from "@/lib/utils/zodValidation.utils";
import { userLocalInfo } from "./drizzle.types";

export const courseSchema = {
  schema: z
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
    }),
  defaults: {
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
  },
};

export const bundleSchema = {
  schema: z.object({
    year: required_number,
    cycle: required_string,
    category: required_string,
    attendance: required_string,
    deadline: required_date,
    courses: optional_selectOptions,
  }),
  defaults: {
    year: "",
    cycle: "",
    category: "",
    attendance: "",
    deadline: new Date(),
    courses: [],
  },
};

export const fellowSchema = {
  schema: z.object({
    firstName: required_string,
    lastName: required_string,
    bio: required_string,
    email: required_email,
    tel: optional_tel,
  }),
  defaults: {
    firstName: "",
    lastName: "",
    bio: "",
    email: "",
    tel: "",
  },
};

export const addStudentSchema = {
  schema: z.object({
    students: z.array(z.object({})),
    courseId: required_number,
  }),
  defaults: (courseId: number, students: Option[]) => ({
    students: students || [],
    courseId,
  }),
};

export const userProfileSchema = {
  schema: z.object({
    id: required_string,
    firstName: required_string,
    lastName: required_string,
    userName: required_string,
    avatar: optional_string,
    bio: optional_string,
    email: required_email,
    tel: optional_tel,
  }),
  defaults: (user: userLocalInfo) => ({
    id: user.id || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    userName: user.userName || "",
    avatar: user.avatar || "",
    bio: user.bio || "",
    email: user.email || "",
    tel: user.tel || "",
  }),
};

export type CourseSchema = z.infer<typeof courseSchema.schema>;
export type BundleSchema = z.infer<typeof bundleSchema.schema>;
export type FellowSchema = z.infer<typeof fellowSchema.schema>;
export type AddStudentSchema = z.infer<typeof addStudentSchema.schema>;
export type UserProfileSchema = z.infer<typeof userProfileSchema.schema>;
