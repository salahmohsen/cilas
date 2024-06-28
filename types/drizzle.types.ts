import { courseTable, userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type CoursesFilter =
  | "all published"
  | "ongoing"
  | "archived"
  | "starting soon"
  | "draft";

export type DbCourse = {
  course: InferSelectModel<typeof courseTable>;
  user: InferSelectModel<typeof userTable>;
};

export type DbCourses = {
  course: InferSelectModel<typeof courseTable>;
  user: InferSelectModel<typeof userTable>;
}[];
