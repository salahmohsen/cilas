import { courseSchema } from "@/types/courseForm.schema";
import { z } from "zod";
import { cleanHtml } from "./sanitize-html.utils";
import { convertToDate, convertToJson } from "./zodValidation.utils";
import { InferInsertModel } from "drizzle-orm";
import { courseTable } from "@/db/schema";

export const formDataToCourseSchema = (
  formData: FormData,
): z.infer<typeof courseSchema> => {
  const enTitle = formData.get("enTitle") as string;
  const arTitle = formData.get("arTitle") as string;
  const enContent = formData.get("enContent") as string;
  const arContent = formData.get("arContent") as string;
  const authorId = formData.get("authorId") as string;
  const category = formData.get("category") as string;
  const image = formData.get("image") as string | File;
  const attendance = formData.get("attendance") as string;
  const isRegistrationOpen = formData.get("isRegistrationOpen") === "Open";
  const price = formData.get("price") as string;
  const timeSlot = formData.get("timeSlot") as string;
  const days = formData.get("days") as string;
  const courseFlowUrl = formData.get("courseFlowUrl") as string;
  const applyUrl = formData.get("applyUrl") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  return {
    enTitle,
    arTitle,
    enContent: cleanHtml(enContent),
    arContent: cleanHtml(arContent),
    authorId,
    category,
    image,
    attendance,
    isRegistrationOpen,
    price,
    timeSlot: {
      from: convertToDate(timeSlot, "from"),
      to: convertToDate(timeSlot, "to"),
    },
    days: convertToJson(days),
    courseFlowUrl,
    applyUrl,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };
};

export const courseSchemaToDbSchema = (
  formObj: z.infer<typeof courseSchema>,
  draftMode: boolean,
  image: string,
): InferInsertModel<typeof courseTable> => {
  return {
    ...formObj,
    draftMode,
    image,
  };
};
