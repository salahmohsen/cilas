import { PrivateCourse } from "./courses.actions.types";
import { CoursesFilter } from "./courses.slice.types";

export const getCourseStatus = (course: PrivateCourse): CoursesFilter | undefined => {
  const currentDate = new Date();
  const startDate = new Date(course.startDate);
  const endDate = new Date(course.endDate);
  const isDraft = course.isDraft;

  if (isDraft) return CoursesFilter.Draft;
  if (startDate <= currentDate && endDate >= currentDate) return CoursesFilter.Ongoing;
  if (startDate > currentDate) return CoursesFilter.StartingSoon;
  if (endDate < currentDate) return CoursesFilter.Archived;
  console.error("unknown status");
};
