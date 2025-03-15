import { Option } from "@/components/ui/multipleSelector";
import { CourseTableWrite } from "@/lib/types/drizzle.types";
import { bundleSchema, CourseSchema } from "@/lib/types/form.schema";
import { CoursesFilter } from "../types/course.slice.types";
import { CourseWithFellowAndStudents } from "../types/drizzle.types";
import { cleanHtml } from "./sanitize-html.utils";
import { convertToDate, convertToJson } from "./zodValidation.utils";

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

export const parseBundleData = async (formData: FormData) => {
  const year = Number(formData.get("year") as string);
  const cycle = formData.get("cycle") as string;
  const category = formData.get("category") as string;
  const attendance = formData.get("attendance") as string;
  const deadline = new Date(formData.get("deadline") as string);
  const courses = JSON.parse(formData.get("courses") as string) as Option[];

  try {
    const parse = bundleSchema.schema.safeParse({
      year,
      cycle,
      category,
      attendance,
      deadline,
      courses,
    });
    if (!parse.success) {
      throw new Error(
        `There is errors on these fields: ${parse.error?.errors.map((e) => e.path[0])}`,
      );
    }
    return { courses, year, cycle, category, attendance, deadline };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }
};
