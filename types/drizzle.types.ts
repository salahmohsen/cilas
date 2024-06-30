import { courseTable, userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type User = InferSelectModel<typeof userTable>;

export type CoursesFilter =
  | "all published"
  | "ongoing"
  | "archived"
  | "starting soon"
  | "draft";

export type CourseWithAuthor = InferSelectModel<typeof courseTable> & {
  author: InferSelectModel<typeof userTable>;
};
