import { courseTable } from "@/lib/db/db.schema";
import { CoursesFilter } from "@/lib/types/manage.courses.types";
import { eq, gte, lte, lt, gt, and } from "drizzle-orm";

export const coursesFilter = (filter: CoursesFilter) => {
  if (filter === "published") {
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
