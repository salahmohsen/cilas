import { bundleTable, courseTable, userTable } from "@/db/db.schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type SafeUser = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserWithSensitiveCols = InferSelectModel<typeof userTable>;

export type CoursesFilter =
  | "published"
  | "ongoing"
  | "archived"
  | "starting soon"
  | "draft"
  | "bundles";

export interface Course extends InferSelectModel<typeof courseTable> {}

export interface CourseWithFellow extends Course {
  fellow: SafeUser;
}

export type BundleTable = InferInsertModel<typeof bundleTable>;
