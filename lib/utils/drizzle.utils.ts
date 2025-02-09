import { courseTable } from "@/lib/db/db.schema";
import { CoursesFilter } from "@/lib/types/course.slice.types";
import { and, eq, gt, gte, lt, lte } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

type TimeSlot = {
  from: Date;
  to: Date;
};

export const timeSlot = customType<{ data: TimeSlot }>({
  dataType: () => "jsonb",
  fromDriver: (value: unknown): TimeSlot => {
    // Runtime validation
    if (typeof value === "object" && value !== null) {
      const slot = value as { from?: string; to?: string };
      return {
        from: new Date(slot.from || Date.now()),
        to: new Date(slot.to || Date.now()),
      };
    }
    throw new Error("Invalid time slot format");
  },
  toDriver: (value: TimeSlot): unknown => ({
    from: value.from.toISOString(),
    to: value.to.toISOString(),
  }),
});

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
    return and(lt(courseTable.endDate, new Date()), eq(courseTable.draftMode, false));
  }
  if (filter === CoursesFilter.StartingSoon) {
    return and(gt(courseTable.startDate, new Date()), eq(courseTable.draftMode, false));
  }
  if (filter === CoursesFilter.Draft) {
    return eq(courseTable.draftMode, true);
  }
};
