import { CourseSchema, courseSchema } from "@/lib/types/course.schema";
import { z } from "zod";
import { CourseTableWrite } from "@/lib/types/drizzle.types";
import { cleanHtml } from "./sanitize-html.utils";
import { convertToDate, convertToJson } from "./zodValidation.utils";

export const formDataToCourseSchema = (
  formData: FormData,
): z.infer<typeof courseSchema> => {
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
