import { courseTable, userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";

export type SafeUser = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserWithSensitiveCols = InferSelectModel<typeof userTable>;

export type CoursesFilter =
  | "all published"
  | "ongoing"
  | "archived"
  | "starting soon"
  | "draft";

export interface Course extends InferSelectModel<typeof courseTable> {}

export interface CourseWithFellow extends Course {
  fellow: SafeUser;
}
