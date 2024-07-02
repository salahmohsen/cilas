import { courseTable, userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type User = InferSelectModel<typeof userTable>;

export type CoursesFilter =
  | "all published"
  | "ongoing"
  | "archived"
  | "starting soon"
  | "draft";

export interface Course extends InferSelectModel<typeof courseTable> {}

export interface CourseWithAuthor extends Course {
  author: InferSelectModel<typeof userTable>;
}
