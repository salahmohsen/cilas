import { courseTable } from "@/db/schema";
import { CoursesFilter } from "@/types/drizzle.types";
import { eq, gte, lte, lt, gt, sql, and } from "drizzle-orm";

export const coursesFilter = (filter: CoursesFilter) => {
  if (filter === "all published") {
    return eq(courseTable.draftMode, false);
  }
  if (filter === "ongoing") {
    return and(
      gte(courseTable.endDate, new Date()),
      lte(courseTable.startDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === "archived") {
    return and(
      lt(courseTable.endDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === "starting soon") {
    return and(
      gt(courseTable.startDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === "draft") {
    return eq(courseTable.draftMode, true);
  }
};
