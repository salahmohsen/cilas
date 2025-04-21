import { CourseTableWrite } from "@/lib/drizzle/drizzle.types";
import { CourseWithFellowAndStudents } from "../../../../../lib/drizzle/drizzle.types";
import { cleanHtml } from "../../../../../lib/utils/sanitize.html.utils";
import { convertToDate, convertToJson } from "../../../../../lib/utils/zod.utils";
import { CourseSchema } from "./course.schema";
import { CoursesFilter } from "./courses.slice.types";

export const formDataToCourseSchema = (formData: FormData): CourseSchema => {
  const enTitle = formData.get("enTitle") as string;
  const arTitle = formData.get("arTitle") as string;
  const enContent = formData.get("enContent") as string;
  const arContent = formData.get("arContent") as string;
  const fellowId = formData.get("fellowId") as string;
  const category = formData.get("category") as string;
  const featuredImage = formData.get("featuredImage") as string | File;
  const attendance = formData.get("attendance") as string;
  const isRegistrationOpen = formData.get("isRegistrationOpen") === "Open";
  const suggestedPrice = formData.get("suggestedPrice") as string;
  const timeSlot = formData.get("timeSlot") as string;
  const days = formData.get("days") as string;
  const applyUrl = formData.get("applyUrl") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  return {
    enTitle,
    arTitle,
    enContent: cleanHtml(enContent),
    arContent: cleanHtml(arContent),
    fellowId,
    category,
    featuredImage,
    attendance,
    isRegistrationOpen,
    suggestedPrice: JSON.parse(suggestedPrice),
    timeSlot: {
      from: convertToDate(timeSlot, "from"),
      to: convertToDate(timeSlot, "to"),
    },
    days: convertToJson(days),
    applyUrl,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };
};

export const courseSchemaToDbSchema = (
  formObj: CourseSchema,
  draftMode: boolean,
  featuredImage: string,
): CourseTableWrite => {
  return {
    ...formObj,
    enContent: JSON.parse(formObj.enContent || ""),
    arContent: JSON.parse(formObj.arContent || ""),
    draftMode,
    featuredImage,
  };
};

export const getCourseStatus = (
  course: CourseWithFellowAndStudents,
): CoursesFilter | undefined => {
  const currentDate = new Date();
  const startDate = new Date(course.startDate);
  const endDate = new Date(course.endDate);
  const isDraft = course.draftMode;

  if (isDraft) return CoursesFilter.Draft;
  if (startDate <= currentDate && endDate >= currentDate) return CoursesFilter.Ongoing;
  if (startDate > currentDate) return CoursesFilter.StartingSoon;
  if (endDate < currentDate) return CoursesFilter.Archived;
  console.error("unknown status");
};
