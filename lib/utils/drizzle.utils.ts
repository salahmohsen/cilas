import { courseTable } from "@/lib/db/db.schema";
import { CoursesFilter } from "@/lib/types/course.slice.types";
import { and, eq, gt, gte, lt, lte } from "drizzle-orm";

export const coursesFilter = (filter: CoursesFilter) => {
  if (filter === CoursesFilter.AllPublished) {
    return eq(courseTable.draftMode, false);
  }
  if (filter === CoursesFilter.Ongoing) {
    return and(
      gte(courseTable.endDate, new Date()),
      lte(courseTable.startDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === CoursesFilter.Archived) {
    return and(
      lt(courseTable.endDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === CoursesFilter.StartingSoon) {
    return and(
      gt(courseTable.startDate, new Date()),
      eq(courseTable.draftMode, false),
    );
  }
  if (filter === CoursesFilter.Draft) {
    return eq(courseTable.draftMode, true);
  }
};
