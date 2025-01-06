import { bundleTable, courseTable, userTable } from "@/lib/db/db.schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type CourseTableRead = InferSelectModel<typeof courseTable>;
export type CourseTableWrite = InferInsertModel<typeof courseTable>;
export type BundleTableWrite = InferInsertModel<typeof bundleTable>;

export type userLocalInfo = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserWithSensitiveCols = InferSelectModel<typeof userTable>;

export type CourseWithSafeFellow = CourseTableRead & {
  fellow: userLocalInfo;
};

export type BundleWithCoursesNames = InferSelectModel<typeof bundleTable> & {
  courses: Pick<CourseTableRead, "id" | "enTitle" | "arTitle">[];
};
