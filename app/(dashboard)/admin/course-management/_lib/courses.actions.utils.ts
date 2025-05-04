import { CoursesFilter } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { courseTable } from "@/lib/drizzle/schema";
import { convertToDate, safeJsonParse } from "@/lib/utils";
import { and, eq, gt, gte, lt, lte } from "drizzle-orm";
import { z } from "zod";
import courseSchema, { CourseSchema } from "./course.schema";
import { Attendance } from "./courses.actions.types";

export const formDataToCourseSchema = (formData: FormData): CourseSchema => {
  try {
    // Extract all values at once
    const rawData = {
      enTitle: formData.get("enTitle"),
      arTitle: formData.get("arTitle"),
      enContent: formData.get("enContent"),
      arContent: formData.get("arContent"),
      slug: formData.get("slug"),
      fellowId: formData.get("fellowId"),
      category: formData.get("category"),
      featuredImage: formData.get("featuredImage"),
      attendance: formData.get("attendance") as Attendance,
      isRegistrationOpen: formData.get("isRegistrationOpen") === "Open",
      suggestedPrice: safeJsonParse(
        formData.get("suggestedPrice"),
        "failed parsing suggestedPrice",
      ),
      timeSlot: {
        from: convertToDate(
          formData.get("timeSlot"),
          "failed parsing timeSlot => from date",
          "from",
        ),
        to: convertToDate(
          formData.get("timeSlot"),
          "failed parsing timeSlot => to date",
          "to",
        ),
      },
      days: safeJsonParse(formData.get("days"), "failed parsing days"),
      applyUrl: formData.get("applyUrl"),
      startDate: convertToDate(formData.get("startDate"), "failed to get the start date"),
      endDate: convertToDate(formData.get("endDate"), "failed to get end date"),
    };

    return courseSchema.schema.parse(rawData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Form data validation failed:", error.errors);
      throw new Error(
        `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw error;
  }
};

export const drizzleCourseFilter = (filter: CoursesFilter) => {
  try {
    if (!filter) throw new Error("no drizzle course filter or id array provided!");

    switch (filter) {
      case CoursesFilter.AllPublished:
        return eq(courseTable.isDraft, false);

      case CoursesFilter.Ongoing:
        return and(
          gte(courseTable.endDate, new Date()),
          lte(courseTable.startDate, new Date()),
          eq(courseTable.isDraft, false),
        );

      case CoursesFilter.Archived:
        return and(lt(courseTable.endDate, new Date()), eq(courseTable.isDraft, false));

      case CoursesFilter.StartingSoon:
        return and(gt(courseTable.startDate, new Date()), eq(courseTable.isDraft, false));

      case CoursesFilter.Draft:
        return eq(courseTable.isDraft, true);

      default:
        throw new Error(`Unhandled filter type ${filter}`);
    }
  } catch (error) {
    if (error instanceof Error) throw new Error(error.message);
    throw new Error("Failed to generate drizzle course filter!");
  }
};
