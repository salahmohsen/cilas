import { CoursesFilter } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { courseTable } from "@/lib/drizzle/schema";
import { and, eq, gt, gte, lt, lte } from "drizzle-orm";

export const coursesFilter = (filter: CoursesFilter) => {
  switch (filter) {
    case CoursesFilter.AllPublished:
      return eq(courseTable.draftMode, false);

    case CoursesFilter.Ongoing:
      return and(
        gte(courseTable.endDate, new Date()),
        lte(courseTable.startDate, new Date()),
        eq(courseTable.draftMode, false),
      );

    case CoursesFilter.Archived:
      return and(lt(courseTable.endDate, new Date()), eq(courseTable.draftMode, false));

    case CoursesFilter.StartingSoon:
      return and(gt(courseTable.startDate, new Date()), eq(courseTable.draftMode, false));

    case CoursesFilter.Draft:
      return eq(courseTable.draftMode, true);
  }
};
