import { bundleTable, courseTable, userTable } from "@/lib/db/db.schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type userLocalInfo = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserWithProtectedFields = InferSelectModel<typeof userTable>;

export type CourseTableRead = InferSelectModel<typeof courseTable>;
export type CourseTableWrite = InferInsertModel<typeof courseTable>;
export type CourseWithFellow = CourseTableRead & {
  fellow: userLocalInfo;
};

export type BundleTableWrite = InferInsertModel<typeof bundleTable>;
export type BundleWithCourseTitles = InferSelectModel<typeof bundleTable> & {
  courses: Pick<CourseTableRead, "id" | "enTitle" | "arTitle">[];
};
