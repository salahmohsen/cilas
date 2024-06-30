import { courseSchema } from "@/types/courseForm.schema";
import { z } from "zod";
import { cleanHtml } from "./sanitize-html.utils";
import { convertToDate, convertToJson } from "./zodValidation.utils";
import { InferInsertModel } from "drizzle-orm";
import { courseTable } from "@/db/schema";

export const formDataToCourseSchema = (
  formData: FormData,
): z.infer<typeof courseSchema> => {
  return {
    enTitle: formData.get("enTitle") as string,
    arTitle: formData.get("arTitle") as string,
    enContent: cleanHtml(formData.get("enContent") as string),
    arContent: cleanHtml(formData.get("arContent") as string),
    authorId: formData.get("authorId") as string,
    category: formData.get("category") as string,
    image: formData.get("image") as File | string,
    attendance: formData.get("attendance") as string,
    isRegistrationOpen: formData.get("isRegistrationOpen") === "Open",
    price: formData.get("price") as string,
    timeSlot: {
      from: convertToDate(formData.get("timeSlot") as string, "from"),
      to: convertToDate(formData.get("timeSlot") as string, "to"),
    },
    days: convertToJson(formData.get("days") as string),
    courseFlowUrl: formData.get("courseFlowUrl") as string,
    applyUrl: formData.get("applyUrl") as string,
    dateRange: {
      from: convertToDate(formData.get("dateRange") as string, "from"),
      to: convertToDate(formData.get("dateRange") as string, "to"),
    },
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
