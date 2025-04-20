import { courseTable } from "@/lib/db/schema";
import { CoursesFilter } from "@/lib/types/courses.slice.types";
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
