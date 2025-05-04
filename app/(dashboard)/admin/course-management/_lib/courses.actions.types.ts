import {
  courseCategoriesTable,
  courseFellowTable,
  courseTable,
  courseToCategory,
  enrollmentTable,
} from "@/lib/drizzle/schema";
import { ServerActionReturn } from "@/lib/types/server.actions";
import { SafeUser } from "@/lib/users/users.actions.types";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type CourseTableRead = InferSelectModel<typeof courseTable>;
export type CourseTableWrite = InferInsertModel<typeof courseTable>;

export type Attendance = CourseTableRead["attendance"];

export type CourseFellowsRead = InferSelectModel<typeof courseFellowTable>;
export type CourseFellowsWrite = InferInsertModel<typeof courseFellowTable>;

export type CourseToCategoryRead = InferSelectModel<typeof courseToCategory>;
export type CourseToCategoryWrite = InferInsertModel<typeof courseToCategory>;

export type CourseCategoryRead = InferSelectModel<typeof courseCategoriesTable>;
export type CourseCategoryWrite = InferInsertModel<typeof courseCategoriesTable>;

export type CourseEnrollmentRead = InferSelectModel<typeof enrollmentTable>;
export type CourseEnrollmentWrite = InferInsertModel<typeof enrollmentTable>;

export interface Enrollment extends CourseEnrollmentRead {
  user?: SafeUser;
}

export interface PublicCourse extends CourseTableRead {
  fellows: SafeUser[];
  enrollmentCount: number;
  category: CourseCategoryRead;
}

export interface PrivateCourse extends CourseTableRead {
  enrollments: Enrollment[];
  fellows: SafeUser[];
  enrollmentCount: number;
  category: CourseCategoryRead;
}

export interface CourseFormState extends ServerActionReturn {
  courseId?: number;
}

export interface DeleteCourseState extends ServerActionReturn {
  deletedId?: number;
}
