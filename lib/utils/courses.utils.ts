import { CoursesFilter } from "../types/course.slice.types";
import { CourseWithFellow } from "../types/drizzle.types";

export const getCourseStatus = (course: CourseWithFellow): CoursesFilter | undefined => {
  const currentDate = new Date();
  const startDate = new Date(course.startDate);
  const endDate = new Date(course.endDate);
  const isDraft = course.draftMode;

  if (isDraft) return CoursesFilter.Draft;
  if (startDate <= currentDate && endDate >= currentDate) return CoursesFilter.Ongoing;
  if (startDate > currentDate) return CoursesFilter.StartingSoon;
  if (endDate < currentDate) return CoursesFilter.Archived;
  console.error("unknown status");
};
